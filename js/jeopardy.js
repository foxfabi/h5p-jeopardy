var H5P = H5P || {};

/**
 * Constructor.
 */
H5P.Jeopardy = (function ($, JoubelUI, Question) {

  
  /**
   * @constructor
   * @extends Question
   * @param {object} options Options for jeopardy
   * @param {string} contentId H5P instance id
   * @param {Object} contentData H5P instance data
   */
  function Jeopardy(options, contentId, contentData) {
    if (!(this instanceof H5P.Jeopardy)) {
      return new H5P.Jeopardy(options);
    }
    
    this.contentId = contentId;
    
    Question.call(this, 'jeopardy');
    
    /**
     * Keeps track of the content data. Specifically the previous state.
     * @type {Object}
     */
    this.contentData = contentData;
    if (contentData !== undefined && contentData.previousState !== undefined) {
      this.previousState = contentData.previousState;
      this.questionIndex = this.contentData.previousState.progress;
    }

    /**
     * Keeps track of the amount of cards in the deck.
     * @type {string}
     */    
    this.maxCards = 0;

    /**
     * Keeps track of the maximum amount of points.
     * @type {string}
     */    
    this.maxScore = 0;

    /**
     * Keeps track of the achieved points.
     * @type {string}
     */    
    this.userScore = 0;

    /**
     * Keeps track of the answered cards.
     * @type {string}
     */    
    this.userCards = 0;

    // Set default behavior.
    this.options = $.extend({
      intro: "Jeopardy",
      chooseBtnLabel: "Choose",
      checkBtnLabel: "Check",
      nextBtnLabel: "Next",
      answeredCorrectly: "Answered correctly",
      answeredIncorrectly: "Answered incorrectly"
    }, options);

    H5P.EventDispatcher.call(this);
    this.on('resize', this.resize, this);
  }
  Jeopardy.prototype = Object.create(H5P.EventDispatcher.prototype);
  Jeopardy.prototype.constructor = Jeopardy;

  /**
   * Registers this question type's DOM elements before they are attached.
   * Called from H5P.Question.
   */
  Jeopardy.prototype.registerDomElements = function () {
    this.setContent(this.createContent());
    this.resize();
  }

  /**
   * Create wrapper and main content for question.
   * @returns {H5P.jQuery} Wrapper
   */
  Jeopardy.prototype.createContent = function () {     
    this.$wrapper = $('<div>', {
      'class': 'h5p-jeopardy'
    })     
    this.$mainContent = $('<div/>', {
      'class': 'h5p-jeopardy-main-content'
    }).appendTo(this.$wrapper);
    
    this.buildGamePage(this.$mainContent);
    this.buildFeedbackPage(this.$wrapper);
    return this.$wrapper;
  }

  /**
   * Build the introduction page container
   */
  Jeopardy.prototype.buildGamePage = function (container) {
    var self = this;
    
    this.$title = $('<div/>', {
      'class': 'h5p-jeopardy-title',
      'tabindex': 0,
      'html' : this.options.intro,
      'aria-label' : $("" + this.options.intro).text()
    }).appendTo(container);

    this.$gridContainer = this.createGrid().appendTo(container);
    this.$cluePage = this.createQuestionPage().appendTo(container);
    
    
    this.$cluePage.hide();
  }

  /**
   * Build the feedback page container
   */
  Jeopardy.prototype.buildFeedbackPage = function (container) {
    var self = this;

    this.$feedbackContainer = $('<div/>', {
      'id': 'h5p-jeopardy-feedback-container'
    }).appendTo(container).hide();

    var feedbackInnerContainer = $('<div/>', {
      'id': 'h5p-jeopardy-feedback-inner-container',
      'class': 'inner',
    }).appendTo(this.$feedbackContainer);

    var feedbackContent = $('<div/>', {
      'id': 'h5p-jeopardy-feedback-content',
      'class': 'child',
    }).appendTo(feedbackInnerContainer);

    var feedbackMessage = $('<p/>', {
      'id': 'h5p-jeopardy-feedback-content-message',
    }).appendTo(feedbackContent);

    // Add overall feedback score bar
    this.overallFeedbackScoreBar = new H5P.JoubelScoreBar(this.getMaxScore());
    this.overallFeedbackScoreBar.appendTo(feedbackContent);

    // Add retry button, if enabled and as standalone task
    var jeopardyButtons = $('<div/>', {
      'id': 'h5p-jeopardy-buttons-container',
      'class': 'child',
    }).appendTo(feedbackContent);

    var enableRetry = this.options.behaviour.enableRetry;
    if((enableRetry === true) && (this.contentData.standalone === true)) {
      this.$retryButton = JoubelUI.createButton({
        'class': 'h5p-results-retry-button h5p-invisible h5p-button',
        'id': 'h5p-jeopardy-button-retry',
        'html': this.options.retryBtnLabel
      }).click(function () {
        self.resetTask();
      }).appendTo(jeopardyButtons);
    }


  }

  /**
   * Show evaluation widget, i.e: 'You got x of y points'
   */
  Jeopardy.prototype.showEvaluation = function () {
    var self = this;
    var maxScore = self.getMaxScore();
    var score = self.getScore();
    var scoreText = self.options.overallFeedback.replace('@score', score).replace('@total', maxScore);
    
    $('#h5p-jeopardy-feedback-content-message').html( scoreText );
    self.overallFeedbackScoreBar.setScore(score);
    $('#h5p-jeopardy-question-container').hide();
    $('#h5p-jeopardy-feedback-container').css({'opacity':0}).show();
    $('#h5p-jeopardy-feedback-container').animate({'opacity':1}, 300);

    // Show/Hide retry button, if enabled
    var enableRetry = self.options.behaviour.enableRetry;
    if((enableRetry === true) && (self.contentData.standalone === true)) {
      if (self.getScore() < self.getMaxScore()) {
        self.$retryButton.removeClass('h5p-invisible');
      } else {
        self.$retryButton.addClass('h5p-invisible');
      }
    } 
    self.trigger('resize');
  };
  
  Jeopardy.prototype.createQuestionPage = function() {
    var self = this;
    self.$cluePage = $('<div>', {
      'class': 'h5p-jeopardy-clue-page grid grid-pad'
    });
    $inner = $('<div>', {
      'class': 'h5p-jeopardy-clue-container'
    });

    $topic = $('<div>', {
      'class': 'h5p-jeopardy-clue-topic'
    }).appendTo($inner);

    $clue = $('<div>', {
      'class': 'h5p-jeopardy-clue-clue'
    }).appendTo($inner);

    
    var response = $('<span>', {
      'aria-atomic': true,
      'class': "h5p-input-wrapper"
    });
    
    self.responseInput = $('<input>', {
      'id': "h5p-jeopardy-user-answer",
      'type': "text",
      'class': "h5p-text-input",
      'autocapitalize': "off"
    }).appendTo(response);

    // Listen to Enter key to submit answer
    self.responseInput.on('keypress', function (e) {
      if(e.keyCode == 13) {
        self.checkAnswer(self.checkBtn);
      }
    });
    response.appendTo($inner);

    self.checkBtn = JoubelUI.createButton({
      'class': 'h5p-jeopardy-check',
      'id': 'h5p-jeopardy-check',
      'html': self.options.checkBtnLabel,
    }).click(function () {
      self.checkAnswer($(this));
    }).appendTo($inner);
    
    JoubelUI.createButton({
      'class': 'h5p-jeopardy-next',
      'id': 'h5p-jeopardy-next',
      'html': self.options.nextBtnLabel,
    }).click(function () {
        self.nextClue();
    }).appendTo($inner).hide();


    $inner.appendTo(self.$cluePage);
    return self.$cluePage;
  };
  
  /**
   * Check if the answer is correct.
   */
  Jeopardy.prototype.checkAnswer = function(element) {
    var self = this;
    var containerId = element.attr("data-id");
    var isCorrect = self.checkClue(containerId, $('#h5p-jeopardy-user-answer').val());
    var answerMessage = '';
    if (isCorrect) {
      var clueId = self.extractElementInfo(containerId, 2);
      var value = (parseInt(clueId)+1) * self.options.multiplicator;
      self.userScore = self.userScore + parseInt(value);
      $('#' + containerId + ' .jeopardy-inner').addClass('h5p-correct');
      $('.h5p-input-wrapper').addClass('h5p-correct');
      $('#h5p-jeopardy-next').attr('aria-label', self.options.answeredCorrectly + "   " + self.options.nextBtnLabel);
    }
    else {
      $('#' + containerId + ' .jeopardy-inner').addClass('h5p-wrong');
      $('.h5p-input-wrapper').addClass('h5p-wrong');
      $('#h5p-jeopardy-next').attr('aria-label', self.options.answeredIncorrectly + "   " + self.options.nextBtnLabel);
    }
    $('#h5p-jeopardy-user-answer').attr('disabled', true);
    $('#' + containerId + ' button').hide();
    element.hide();
    $('#h5p-jeopardy-next').show().focus();
    self.userCards++;
  }

  /**
   * Check if the answer is correct.
   */
  Jeopardy.prototype.checkClue = function(id, answered) {
    var self = this;

    if (self.options.caseSensitive !== true) {
      answered = answered.toLowerCase();
    }
    //console.log(id);
    var topicId = self.extractElementInfo(id, 1);
    var clueId = self.extractElementInfo(id, 2);
    var question = self.options.topics[topicId].clues[clueId].question;
    var solutions = self.searchSolutions(question);
    for (var i = 0; i < solutions.solutions.length; i++) {
      if (answered === solutions.solutions[i]) {
        return true;
      }
    }
    return false;
  };

  /**
   * Creates the game page grid with topic labels and clues.
   */  
  Jeopardy.prototype.createGrid = function() {
    var self = this;
    var topic; // keeps track of current topic
    var css;   // keeps track of grid column amount
    var maxClues = 0; // keeps track of overall maximum of clues
    
    self.$cluesContainer = $('<div>', {
      'class': 'h5p-jeopardy-grid-container grid grid-pad'
    });
    
    css = "jeopardy-col col-1-" + self.options.topics.length;
    
    // creates topic labels
    for (topic in self.options.topics) {
      if (self.options.topics[topic].clues.length > maxClues) {
        maxClues = self.options.topics[topic].clues.length
      }
      self.createTopic(css, self.options.topics[topic].topic).appendTo(self.$cluesContainer);
    }

    // creates topic clues
    var i;
    css = "jeopardy-clue col-1-" + self.options.topics.length;
    for (i = 0; i < maxClues; i++) {
      for (topic in self.options.topics) {
        var topicName = self.options.topics[topic].topic;
        if (self.options.topics[topic].clues[i] !== undefined) {
          self.maxCards++;
          var value = (i+1) * self.options.multiplicator;
          self.maxScore = self.maxScore + parseInt(value);
          var id = 't' + topic + 'c' + i; // used to fetch clue
          self.createClue(id, css, value, topicName).appendTo(self.$cluesContainer);
        } else {
          clueEmpty = $('<div>', {
            'class': css + " empty",
            html: "<div>&nbsp;</div>"
          }).appendTo(self.$cluesContainer);
        }
        //$clue.appendTo(self.$pagesContainer);
      }
    }
    return self.$cluesContainer;
  };

  /**
   * Creates a clue for the page grid
   */
  Jeopardy.prototype.createClue = function(id, css, value, topic) {
    var self = this;
    clueContainer = $('<div>', {
      'class': css
    });
    
    clueContent = $('<div>', {
      'class': "jeopardy-clue-content",
      'id': id
    }).appendTo(clueContainer);
    
    clueInnerContent = $('<div>', {
      'class': "jeopardy-inner"
    }).appendTo(clueContent);

    clueValue = $('<div>', {
      'class': 'jeopardy-clue-data',
      'html': value
    }).appendTo(clueInnerContent);

    clueMobileView = $('<div>', {
      'class': 'jeopardy-clue-data-mobile',
      'html': self.options.clueLabel.replace('@topic', topic).replace('@value', value)
    }).appendTo(clueInnerContent);
    
    // Add question and response data
    //var clue = $("#" + id);
    JoubelUI.createButton({
      'class': 'h5p-jeopardy-choose',
      'html': self.options.chooseBtnLabel,
      'aria-label' : self.options.chooseMessage.replace('@topic', topic).replace('@value', value),
      //'id' : 'choose-' + id,
      'data-id': id
    }).click(function () {
      self.viewClue($(this).attr("data-id"));
    }).appendTo(clueInnerContent);
    return clueContainer;
  }

  /**
   * Creates a topic label
   */
  Jeopardy.prototype.createTopic = function(css, label) {
    topicContainer = $('<div>', {
      'class': css
    });

    topicContent = $('<div>', {
      'class': "jeopardy-topic-content"
    }).appendTo(topicContainer);

    topicLabel = $('<div>', {
      'class': "jeopardy-inner jeopardy-topic",
      html: label
    }).appendTo(topicContent);
    
    return topicContainer;
  }

  /**
   * Extracts topic and clue index from element id
   */  
  Jeopardy.prototype.extractElementInfo = function(topiclue, type) {
    var regex = /^t([0-9]*)c([0-9]*)/m;
    if(regex.test(topiclue)) {
      m = topiclue.match(regex);
      if (type == 1) {return m[1];}
      else {return m[2];}
    }
    return false;
  }

  /**
   * View the clue associated to element
   */
  Jeopardy.prototype.viewClue = function(element) {
    var topicId, clueId;
    var id = element.replace(/choose-/g, "");
    var self = this;
    var topicId = self.extractElementInfo(id, 1);
    var clueId = self.extractElementInfo(id, 2);
    var topic = self.options.topics[topicId].topic;
    var value = (parseInt(clueId)+1) * self.options.multiplicator;
    //console.log(element + "," + topicId + "," + clueId + "," + topic + "," + value);
    var response = self.options.topics[topicId].clues[clueId].response;
    var clueLabel = self.options.clueLabel.replace('@topic', topic).replace('@value', value);
    $('.h5p-input-wrapper').removeClass('h5p-correct h5p-wrong');
    $('#h5p-jeopardy-user-answer').val('');
    $('#h5p-jeopardy-user-answer').attr('disabled', false);
    $('.h5p-jeopardy-clue-topic').html(clueLabel);
    $('.h5p-jeopardy-clue-clue').html(response);
    $('#h5p-jeopardy-check').attr('data-id', id);
    $('.h5p-jeopardy-check').show();
    $('#h5p-jeopardy-next').hide();
    $('.h5p-jeopardy-grid-container').hide();
    $('.h5p-jeopardy-clue-page').show();
    var announceClue = clueLabel + " " + response;
    $('#h5p-jeopardy-user-answer').attr('aria-label', announceClue);
    $('#h5p-jeopardy-user-answer').focus();
  };

  /**
   * Close the actual clue and shows the game board again
   */
  Jeopardy.prototype.nextClue = function() {
    var self = this;
    $('#h5p-jeopardy-next').blur();
    if (self.userCards >= self.maxCards) {
      $('.h5p-jeopardy-clue-page').hide();
      $('.h5p-jeopardy-grid-container').hide();
      self.showEvaluation();
      $('.h5p-jeopardy-result-page').show();
      $('#h5p-jeopardy-result').focus();
    } else {
      $('.h5p-jeopardy-clue-page').hide();
      $('.h5p-jeopardy-grid-container').show();
      $('.h5p-jeopardy-title').show().focus();
    }
  }

  /**
   * Parse the solution text (text between the asterisks)
   *
   * @param {string} solutionText
   * @returns {object} with the following properties
   *  - tip: the tip text for this solution, undefined if no tip
   *  - solutions: array of solution words
   */
  Jeopardy.prototype.parseSolution = function (solutionText) {
    var tip, solution;
    var self = this;
    var tipStart = solutionText.indexOf(':');
    if (tipStart !== -1) {
      // Found tip, now extract
      tip = solutionText.slice(tipStart + 1);
      solution = solutionText.slice(0, tipStart);
    }
    else {
      solution = solutionText;
    }

    // Split up alternatives
    var solutions = solution.split('/');

    // Trim solutions
    for (var i = 0; i < solutions.length; i++) {
      solutions[i] = H5P.trim(solutions[i]);

      //decodes html entities
      var elem = document.createElement('textarea');
      elem.innerHTML = solutions[i];
      solutions[i] = elem.value;
    }

    if (self.options.caseSensitive !== true) {
      // Convert possible solutions into lowercase
      for (var i = 0; i < solutions.length; i++) {
        solutions[i] = solutions[i].toLowerCase();
      }
    }

    return {
      tip: tip,
      solutions: solutions
    };
  };

  /**
   * Find answers in a string
   *
   * @param {string} answer
   *   Question text containing answers enclosed in asterisks.
   * @returns {string}
   *   The answers.
   */
  Jeopardy.prototype.searchSolutions = function (answer) {
    var self = this;
    var $solutions = [];
    // Go through the text and extract possible solutions
    var result = answer.match(/\*\s*([^*]*?)\s*\*/);
    var solution = self.parseSolution(result[1]);
    return solution;
  };

  /**
   * Resets the task to its initial state
   * Used for contracts.
   */
  Jeopardy.prototype.resetTask = function () {
    var self = this;
    self.userScore = 0;
    self.userCards = 0;
    self.maxCards = 0;
    $('#h5p-jeopardy-feedback-container').hide();
    // remove played game board and add it again
    $( ".h5p-jeopardy-grid-container" ).remove();
    self.$gridContainer = self.createGrid().appendTo(self.$mainContent);
    $('.h5p-jeopardy-grid-container').show();
    self.trigger('resize');
  }

  /**
   * Update the dimensions of the task when resizing the task.
   */
  Jeopardy.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;
    //Find max required height for all clues
    self.$cluesContainer.children('.jeopardy-clue').each( function () {
      var wrapperHeight = $(this).css('height', 'initial').outerHeight();
      if (wrapperHeight > maxHeight) { maxHeight = wrapperHeight}
    });
    self.$cluesContainer.children('.jeopardy-clue').each( function () {
      $(this).css('height', maxHeight);
    });
    var gridHeight = $('.h5p-jeopardy-grid-container').outerHeight();
    $('.h5p-jeopardy-clue-page').css('height', gridHeight);
    $('.h5p-jeopardy-result-page').css('height', gridHeight);
  };
  
  
  /**
   * Returns the user's score for this task
   * Used for contracts.
   *
   * @returns {Number}
   */
  Jeopardy.prototype.getScore = function () {
    return this.userScore;
  };

  /**
   * Returns the maximum amount of points achievable for this task.
   * Used for contracts.
   *
   * @returns {Number}
   */
  Jeopardy.prototype.getMaxScore = function () {
    return this.maxScore;
  };

  return Jeopardy;
})(H5P.jQuery, H5P.JoubelUI, H5P.Question);
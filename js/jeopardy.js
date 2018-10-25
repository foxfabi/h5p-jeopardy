var H5P = H5P || {};

/**
 * Constructor.
 */
H5P.Jeopardy = (function ($, JoubelUI) {
  
  function Jeopardy(options) {
    if (!(this instanceof H5P.Jeopardy)) {
      return new H5P.Jeopardy(options);
    }
    var self = this;
    self.maxCards = 0;
    self.maxPoints = 0;
    self.userPoints = 0;
    self.userCards = 0;
    // Set default behavior.
    self.options = $.extend({
      intro: "Jeopardy",
      chooseBtnLabel: "Choose",
      checkBtnLabel: "Check",
      nextBtnLabel: "Next",
      answeredCorrectly: "Answered correctly",
      answeredIncorrectly: "Answered incorrectly"
    }, options);
    H5P.EventDispatcher.call(this);
    //this.on('resize', self.resize, self);
  }
  Jeopardy.prototype = Object.create(H5P.EventDispatcher.prototype);
  Jeopardy.prototype.constructor = Jeopardy;
  /**
   * Append field to wrapper.
   *
   * @param {jQuery} $container
   */
  Jeopardy.prototype.attach = function ($container) {
    var self = this;
    this.$inner = $container.addClass('h5p-jeopardy');
    this.$mainContent = $('<div/>', {
      'class': 'h5p-jeopardy-main-content'
    }).appendTo(this.$inner);
    $introPage = $('<div id="intro-page"></div>');
    $title = $('<div/>', {
      'class': 'h5p-jeopardy-title',
      'tabindex': 0,
      'html' : self.options.intro,
      'aria-label' : $("" + self.options.intro).text()
    }).appendTo($introPage);
    this.$score = $('<div/>', {
      'id': 'h5p-jeopardy-score'
    }).appendTo($introPage);
    this.$mainContent.append($introPage);
    // Create grid
    self.$gridContainer = self.createGrid().appendTo(this.$mainContent);
    self.$cluePage = self.createQuestionPage().appendTo(this.$mainContent);
    self.$resultPage = self.createResultPage().appendTo(this.$mainContent);
    self.resize();
    $('.h5p-jeopardy-clue-page').hide();
    $('.h5p-jeopardy-result-page').hide();
  }
  
  Jeopardy.prototype.updateScore = function() {
    var self = this;
    $('#h5p-jeopardy-score').html(self.userPoints + ' / ' + self.maxPoints);
  };

  /**
   * Show evaluation widget, i.e: 'You got x of y blanks correct'
   */
  Jeopardy.prototype.showEvaluation = function () {
    var self = this;
    var maxScore = self.maxPoints;
    var score = self.userPoints;
    var scoreText = self.options.scoreBarLabel.replace(':num', score).replace(':total', maxScore);
    $('#h5p-jeopardy-result').html(scoreText);
    $('#h5p-jeopardy-result').attr('tabindex', 0);
    $('#h5p-jeopardy-result').attr('aria-label', scoreText);
    $('#h5p-jeopardy-result').focus();
  };
  
  Jeopardy.prototype.createResultPage = function() {
    var self = this;
    self.$resultPage = $('<div>', {
      'class': 'h5p-jeopardy-result-page grid grid-pad'
    });
    $inner = $('<div class="h5p-jeopardy-result-container"></div>');
    $result = $('<div id="h5p-jeopardy-result" class="h5p-jeopardy-result">' + self.options.scoreBarLabel + '</div>');
    $result.appendTo($inner);
    $inner.appendTo(self.$resultPage);
    return self.$resultPage;
  };
  
  Jeopardy.prototype.createQuestionPage = function() {
    var self = this;
    self.$cluePage = $('<div>', {
      'class': 'h5p-jeopardy-clue-page grid grid-pad'
    });
    $inner = $('<div class="h5p-jeopardy-clue-container"></div>');
    $topic = $('<div class="h5p-jeopardy-clue-topic">@topic for @value</div>');
    $topic.appendTo($inner);
    $clue = $('<div class="h5p-jeopardy-clue-clue">Clue</div>');
    $clue.appendTo($inner);
    var response = $('<span aria-atomic="true" aria-live="polite" class="h5p-input-wrapper"><input id="h5p-jeopardy-user-answer" type="text" class="h5p-text-input" autocapitalize="off"></span>');
    response.appendTo($inner);

    JoubelUI.createButton({
      'class': 'h5p-jeopardy-check',
      'id': 'h5p-jeopardy-check',
      'html': self.options.checkBtnLabel,
    }).click(function () {
      var isCorrect = self.checkClue($(this), $('#h5p-jeopardy-user-answer').val());
      var containerId = $('#h5p-jeopardy-check').attr("data-id");
      var answerMessage = '';
      if (isCorrect) {
        self.userPoints = self.userPoints + parseInt($('#h5p-jeopardy-check').attr("data-value"));
        $('#' + containerId + ' .jeopardy-inner').addClass('h5p-correct');
        $('.h5p-input-wrapper').addClass('h5p-correct');
        $('#h5p-jeopardy-next').attr('aria-label', self.options.answeredCorrectly + "   " + self.options.nextBtnLabel);
        self.updateScore();
      }
      else {
        $('#' + containerId + ' .jeopardy-inner').addClass('h5p-wrong');
        $('.h5p-input-wrapper').addClass('h5p-wrong');
        $('#h5p-jeopardy-next').attr('aria-label', self.options.answeredIncorrectly + "   " + self.options.nextBtnLabel);
      }
      $('#h5p-jeopardy-user-answer').attr('disabled', true);
      self.userCards++;
      $('#' + containerId + ' button').hide();
      $('#h5p-jeopardy-check').hide();
      $('#h5p-jeopardy-next').show().focus();
    }).appendTo($inner);
    
    JoubelUI.createButton({
      'class': 'h5p-jeopardy-next',
      'id': 'h5p-jeopardy-next',
      'html': self.options.nextBtnLabel,
    }).click(function () {
        self.nextClue();
    }).appendTo($inner).hide();
    $inner.appendTo(self.$cluePage);
    self.updateScore();
    return self.$cluePage;
  };
  
  /**
   * Check if the answer is correct.
   */
  Jeopardy.prototype.checkClue = function($clue, answered) {
    var self = this;
    if (self.options.caseSensitive !== true) {
      answered = answered.toLowerCase();
    }
    var question = self.decrypt($clue.attr("data-question")).toString(CryptoJS.enc.Utf8);
    var solutions = self.searchSolutions(question);
    //console.log(answered);
    //console.log(solutions);
    for (var i = 0; i < solutions.solutions.length; i++) {
      // regular comparison
      //console.log(solutions.solutions[i]);
      if (answered === solutions.solutions[i]) {
        return true;
      }
    }
    return false;
  };
  
  Jeopardy.prototype.createGrid = function() {
    var self = this;
    var topic; var css;
    self.$pagesContainer = $('<div>', {
      'class': 'h5p-jeopardy-grid-container grid grid-pad'
    });
    css = "jeopardy-col col-1-" + self.options.topics.length;
    var maxClues = 0;
    // creates topic labels
    for (topic in self.options.topics) {
      if (self.options.topics[topic].clues.length > maxClues) { maxClues = self.options.topics[topic].clues.length}
      $topic = $('<div class="' + css + '"></div>');
      $content = $('<div class="jeopardy-topic-content"></div>');
      //$content.css("background-color", self.getRandomColor(self.options.topics.length, topic));
      $content.append('<div class="jeopardy-inner jeopardy-topic">' + self.options.topics[topic].topic + '</div>');
      $content.appendTo($topic);
      //$topic.css("background-color", self.getRandomColor(self.options.topics.length, topic));
      $topic.appendTo(self.$pagesContainer);
    }
    // creates topic clues
    var i;
    css = "jeopardy-clue col-1-" + self.options.topics.length;
    for (i = 0; i < maxClues; i++) {
      for (topic in self.options.topics) {
        var topicName = self.options.topics[topic].topic;
        if (self.options.topics[topic].clues[i] !== undefined) {
          self.maxCards++;
          value = (i+1) * self.options.multiplicator;
          self.maxPoints = self.maxPoints + parseInt(value);
          $clue = $('<div class="' + css + '"></div>');
          var id = 'c' + topic + 'r' + i;
          $content = $('<div id="' + id + '" class="jeopardy-clue-content"></div>');
          //$content.css("background-color", self.getRandomColor(self.options.topics.length, topic));
          $inner = $('<div class="jeopardy-inner"></div>');
          $value = $('<div>', {
            'class': 'jeopardy-clue-data',
            'html': value
          });
          $value.appendTo($inner);
          $value = $('<div>', {
            'class': 'jeopardy-clue-data-mobile',
            'html': self.options.clueLabel.replace('@topic', topicName).replace('@value', value)
          });
//          $value = $('<div class="jeopardy-clue-data">' +  + '</div>');
          $value.appendTo($inner);
          // Add question and response data
          //var clue = $("#" + id);
          JoubelUI.createButton({
            'class': 'h5p-jeopardy-choose',
            'html': self.options.chooseBtnLabel,
            'data-topic' : self.encrypt(self.options.topics[topic].topic),
            'data-value' : self.encrypt(value.toString()),
            'aria-label' : self.options.chooseMessage.replace('@topic', topicName).replace('@value', value),
            'data-id' : id,
            'data-question' : self.encrypt(self.options.topics[topic].clues[i].question),
            'data-response' : self.encrypt(self.options.topics[topic].clues[i].response)
          }).click(function () {
            self.viewClue($(this));
          }).appendTo($inner);
          $inner.appendTo($content);
          $content.appendTo($clue);
        } else {
          $clue = $('<div class="' + css + ' empty"><div>&nbsp;</div></div>');
        }
        $clue.appendTo(self.$pagesContainer);
      }
    }
    self.updateScore();
    return self.$pagesContainer;
  };

  Jeopardy.prototype.encrypt = function(message) {
    return CryptoJS.AES.encrypt(message, "H5P.Jeopardy");
  }
  Jeopardy.prototype.decrypt = function(message) {
    return CryptoJS.AES.decrypt(message, "H5P.Jeopardy");
  }

  Jeopardy.prototype.viewClue = function($clue) {
    var self = this;
    var topic = self.decrypt($clue.attr("data-topic")).toString(CryptoJS.enc.Utf8);
    var value = self.decrypt($clue.attr("data-value")).toString(CryptoJS.enc.Utf8);
    var question = self.decrypt($clue.attr("data-question")).toString(CryptoJS.enc.Utf8);
    var response = self.decrypt($clue.attr("data-response")).toString(CryptoJS.enc.Utf8);
    var clueLabel = self.options.clueLabel.replace('@topic', topic).replace('@value', value);
    $('#h5p-jeopardy-user-answer').val('');
    $('.h5p-input-wrapper').removeClass('h5p-correct');
    $('.h5p-input-wrapper').removeClass('h5p-wrong');
    $('#h5p-jeopardy-user-answer').attr('disabled', false);
    $('.h5p-jeopardy-clue-topic').html(clueLabel);
    $('.h5p-jeopardy-clue-clue').html(response);
    $('#h5p-jeopardy-check').attr('data-question', $clue.attr("data-question"));
    $('#h5p-jeopardy-check').attr('data-id', $clue.attr("data-id"));
    $('#h5p-jeopardy-check').attr('data-value', value);
    $('#h5p-jeopardy-check').show();
    $('#h5p-jeopardy-next').hide();
    $('.h5p-jeopardy-grid-container').hide();
    $('.h5p-jeopardy-clue-page').show();
    var announceClue = clueLabel + " " + response;
    $('#h5p-jeopardy-user-answer').attr('aria-label', announceClue);
    $('#h5p-jeopardy-user-answer').focus();
  };

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
   * Update the dimensions of the task when resizing the task.
   */
  Jeopardy.prototype.resize = function () {
    var self = this;
    var maxHeight = 0;
    //Find max required height for all cards
    self.$pagesContainer.children('.jeopardy-clue').each( function () {
      var wrapperHeight = $(this).css('height', 'initial').outerHeight();
      if (wrapperHeight > maxHeight) { maxHeight = wrapperHeight}
    });
    self.$pagesContainer.children('.jeopardy-clue').each( function () {
      $(this).css('height', maxHeight);
    });
    var gridHeight = $('.h5p-jeopardy-grid-container').outerHeight();
    $('.h5p-jeopardy-clue-page').css('height', gridHeight);
    $('.h5p-jeopardy-result-page').css('height', gridHeight);
  };
  return Jeopardy;
})(H5P.jQuery, H5P.JoubelUI);
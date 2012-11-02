var Worddump = require('worddump')
  , batch = require('batchflow')
  , next = require('nextflow')
  , pandoc = require('pdc')
  , S = require('string')

function WordpressConverter (params) {
  this.worddump = new Worddump(params);

  this.noop = function(){}
  this.limit = params.limit || 4;
  this.shouldFetchAuthors = params.authors || true;
  this.articleCallback = this.noop;
  this.errorCallback = function(err){ throw err };
  this.authorCallback = function(author) { return author.display_name };
  this.authors = {};
  this.shouldCleanCode = params.cleanCode || false;
  this.shouldAddParas = params.addParas || true;
  this.totalArticles = 0;
}

WordpressConverter.prototype = {
  article: function(callback) {
    this.articleCallback = callback;
    return this;
  },

  author: function(callback) {
    this.authorCallback = callback;
    return this;
  },

  error: function(callback) {
    this.errorCallback = callback;
    return this;
  },

  end: function(callback) {
    var _this = this;
    next({
      ERROR: function(err) {
        _this.errorCallback(err);
      },
      fetchAuthors: function() {
        if (_this.shouldFetchAuthors) {
          nextflow = this.next;
          _this.worddump.getUsers(function(err, users) {
            if (err) return _this.errorCallback
            for (var i = 0; i < users.length; ++i) 
              _this.authors[users[i].user_id] = _this.authorCallback(users[i]);
            nextflow();
          })
        } else 
          nextflow();
      },
      fetchArticleIds: function() {
        _this.worddump.getPostIds({number: 1000}, this.next);
      },
      fetchArticles: function(err, ids) {
        _this.totalArticles = ids.length;
        batch(ids).parallel(_this.limit)
        .each(function(i, id, next) {
          _this.worddump.getPost(id, function(err, post) {
            var content = post.post_content;
            if (err) {
              _this.errorCallback(err);
              next();
            } else {
              var article = {
                author: _this.authors[post.post_author], 
                title: S(post.post_title).decodeHtmlEntities().s,
                date: post.post_date_gmt,
                slug: post.post_name,
                link: post.link,
                status: post.post_status,
                type: post.post_type,
                content: content
              }
              
              parseTerms(article, post.terms);

              if (_this.shouldCleanCode) //wordpress uses poopy [sourcecode] tags
                article.content = preCleanCode(article.content);

              if (_this.shouldAddParas) //wordpress doesn't have <p> tags when it should
                article.content = preAddParas(article.content);

              _this.worddump.getComments(id, function(err, comments) {
                if (err) this.errorCallback(err);
                article.comments = stripPingbackComments(comments) || [];
                pandoc(article.content, 'html', 'markdown', function(err, result) {
                  if (err) this.errorCallback(err);

                  if (_this.shouldCleanCode)
                    article.content = postCleanCode(result);
                  else
                    article.content = result;

                  _this.articleCallback(article, next);
                })
              })
            }
          })
        })
        .error(_this.errorCallback)
        .end(this.next);
      },
      done: function(){
        callback()
      }
    });
  }
}

module.exports = function(params) {
  return new WordpressConverter(params);
}

function preAddParas(content) {
  var oldContent = content;
  var tokenStart = '<pre>'
    , tokenEnd = '</pre>'
    , pos = content.indexOf(tokenStart);

  //don't touch source code
  while (pos >= 0) {
    var endPos = content.indexOf(tokenEnd, pos);
    var block = content.substring(pos, endPos + tokenEnd.length);
    content = content.replace(block, '');
    pos = content.indexOf(tokenStart);
  }

  //find all new paragraphs
  var paras = content.split('\r\n\r\n');

  for (var i = 0; i < paras.length; ++i) {
    oldContent = oldContent.replace(paras[i], '<p>' + paras[i] + '</p>');
  }

  return oldContent;
}

function preCleanCode(content) {
  var tokenStart = '[sourcecode'
    , tokenEnd = '[/sourcecode]'
    , pos = content.indexOf(tokenStart);


  while (pos >= 0) {
    var endPos = content.indexOf(tokenEnd, pos);
    var block = content.substring(pos, endPos + tokenEnd.length);
    content = content.replace(block, '\n<pre>\n' + block + '\n</pre>\n');
    pos = content.indexOf(tokenStart, endPos + tokenEnd.length);
  }

  return content;
}

function postCleanCode(content) {
  var lines = content.split('\n')
    , inCodeBlock = false
    , langToken = 'language'

  for (var i = 0; i < lines.length; ++i) {
    if (S(lines[i]).trim().startsWith('[sourcecode')) {
      inCodeBlock = true;
      var pos = lines[i].indexOf(langToken)
      if (pos > 0) {
        var q1 = lines[i].indexOf('"', pos);
        var q2 = lines[i].lastIndexOf('"');
        var lang = lines[i].substring(q1 + 1, q2);
        lines[i] = '```' + lang;
      } else {
        lines[i] = '```';
      }
    } else if (S(lines[i]).trim().contains('[/sourcecode')) {
      lines[i] = '```';
      inCodeBlock = false;
    } else {
      if (inCodeBlock)
        lines[i] = lines[i].replace('    ', ''); //trim first 4 spaces
    }
  }

  return lines.join('\n');
}

function parseTerms(article, terms) {
  article.tags = [];
  article.categories = [];

  terms.forEach(function(term) {
    if (term.taxonomy === 'category') {
      article.categories.push(term.name);
    } else if (term.taxonomy === 'tag') {
      article.tags.push(term.name);
    } 
  })
}

function stripPingbackComments(comments) {
  return comments.filter(function(comment) { return comment.type !== 'pingback'})
}



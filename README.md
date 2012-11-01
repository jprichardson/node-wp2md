Node.js - wp2md
================

Dump your WordPress blog into a static blog with Markdown. 


Why?
----

I don't want to use WordPress for blogging anymore. I want to use Markdown so that I can control the look, feel, and templates of my blogs.



Installation
------------

    npm install wp2md



Example
------


```javascript
wp2md({user: 'YOUR_USER_NAME', url: 'http://yourwordpressblog.com', password: 'YOUR_WORDPRESS_PW', cleanCode: true, addParas: true})
.error(function (err) {
  console.error(err);
})
.article(function(article, next) {
  console.dir(article);
  next();
}).end(function() {
  console.log('\n  Done.\n');
})
```

API
---

### constructor

**cleanCode:** Wordpress uses goofy `[sourcode]` blocks. If you want these converted to Github Flavored Markdown code blocks, then set this to true.

**addParas:** Wordpress doesn't always enclose paragraphs with `<p>` html elements. The resulting Markdown may looked squished. Set this to true to fix this. 

**limit:** The number of simultaneous HTTP requests to allow.



### article

Has a callback with a `article` object and `next` function. `next()` controls the rate at which requests happen. You must call `next()` when finished with your `article` data. 

Properties of `article`: `title`, `slug`, `content`, `author`, `tags`, `categories`, `comments`.


License
-------

(MIT License)

Copyright 2012, JP Richardson  <jprichardson@gmail.com>



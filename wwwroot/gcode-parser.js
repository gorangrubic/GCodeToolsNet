/**
 * Parses a string of gcode instructions, and invokes handlers for
 * each type of command.
 *
 * Special handler:
 *   'default': Called if no other handler matches.
 */
function GCodeParser(handlers, modecmdhandlers) {
  this.handlers = handlers || {};
  this.modecmdhandlers = modecmdhandlers || {};

  this.lastArgs = { cmd: null };
  this.lastFeedrate = null;
  this.isUnitsMm = true;

  this.parseLine = function (text, info) {
    //text = text.replace(/;.*$/, '').trim(); // Remove comments
    //text = text.replace(/\(.*$/, '').trim(); // Remove comments
    //text = text.replace(/<!--.*?-->/, '').trim(); // Remove comments

    var origtext = text;
    // remove line numbers if exist
    if (text.match(/^N/i)) {
      // yes, there's a line num
      text = text.replace(/^N\d+\s*/ig, "");
    }

    // collapse leading zero g cmds to no leading zero
    text = text.replace(/G00/i, 'G0');
    text = text.replace(/G0(\d)/i, 'G$1');
    // add spaces before g cmds and xyzabcijkf params
    text = text.replace(/([gmtxyzabcijkfst])/ig, " $1");
    // remove spaces after xyzabcijkf params because a number should be directly after them
    text = text.replace(/([xyzabcijkfst])\s+/ig, "$1");
    // remove front and trailing space
    text = text.trim();

    // see if comment
    var isComment = false;
    if (text.match(/^(;|\(|<)/)) {
      text = origtext;
      isComment = true;
    } else {
      // make sure to remove inline comments
      text = text.replace(/\(.*?\)/g, "");
    }
    //console.log("gcode txt:", text);

    if (text && !isComment) {
      //console.log("there is txt and it's not a comment");
      //console.log("");
      // preprocess XYZIJ params to make sure there's a space
      //text = text.replace(/(X|Y|Z|I|J|K)/ig, "$1 ");
      //console.log("gcode txt:", text);

      // strip off end of line comment
      text = text.replace(/(;|\().*$/, ""); // ; or () trailing
      //text = text.replace(/\(.*$/, ""); // () trailing

      var tokens = [];

      // Execute any non-motion commands on the line immediately
      // Add other commands to the tokens list for later handling
      // Segments are not created for non-motion commands;
      // the segment for this line is created later

      text.split(/\s+/).forEach(function (token) {
        var modehandler = modecmdhandlers[token.toUpperCase()];
        if (modehandler) {
          modehandler();
        } else {
          tokens.push(token);
        }
      });

      if (tokens.length) {
        var cmd = tokens[0];
        cmd = cmd.toUpperCase();
        // check if a g or m cmd was included in gcode line
        // you are allowed to just specify coords on a line
        // and it should be assumed that the last specified gcode
        // cmd is what's assumed
        isComment = false;
        if (!cmd.match(/^(G|M|T)/i)) {
          // if comment, drop it
          /*
          if (cmd.match(/(;|\(|<)/)) {
              // is comment. do nothing.
              isComment = true;
              text = origtext;
              //console.log("got comment:", cmd);
          } else {
          */

          //console.log("no cmd so using last one. lastArgs:", this.lastArgs);
          // we need to use the last gcode cmd
          cmd = this.lastArgs.cmd;
          //console.log("using last cmd:", cmd);
          tokens.unshift(cmd); // put at spot 0 in array
          //console.log("tokens:", tokens);
          //}
        } else {

          // we have a normal cmd as opposed to just an xyz pos where
          // it assumes you should use the last cmd
          // however, need to remove inline comments (TODO. it seems parser works fine for now)

        }
        var args = {
          'cmd': cmd,
          'text': text,
          'origtext': origtext,
          'indx': info,
          'isComment': isComment,
          'feedrate': null,
          'plane': undefined
        };

        //console.log("args:", args);
        if (tokens.length > 1 && !isComment) {
          tokens.splice(1).forEach(function (token) {
            //console.log("token:", token);
            if (token && token.length > 0) {
              var key = token[0].toLowerCase();
              var value = parseFloat(token.substring(1));
              //console.log("value:", value, "key:", key);
              //if (isNaN(value))
              //    console.error("got NaN. val:", value, "key:", key, "tokens:", tokens);
              args[key] = value;
            } else {
              //console.log("couldn't parse token in foreach. weird:", token);
            }
          });
        }
        var handler = this.handlers[cmd] || this.handlers['default'];

        // don't save if saw a comment
        if (!args.isComment) {
          this.lastArgs = args;
          //console.log("just saved lastArgs for next use:", this.lastArgs);
        } else {
          //console.log("this was a comment, so didn't save lastArgs");
        }
        //console.log("calling handler: cmd:", cmd, "args:", args, "info:", info);
        if (handler) {
          // scan for feedrate
          if (args.text.match(/F([\d.]+)/i)) {
            // we have a new feedrate
            var feedrate = parseFloat(RegExp.$1);
            // console.log("got feedrate on this line. feedrate:", feedrate, "args:", args);
            args.feedrate = feedrate;
            this.lastFeedrate = feedrate;
          } else {
            // use feedrate from prior lines
            args.feedrate = this.lastFeedrate;
          }

          //console.log("about to call handler. args:", args, "info:", info, "this:", this);
          return handler(args, info, this);
        } else {
          console.error("No handler for gcode command!!!");
        }

      }
    } else {
      // it was a comment or the line was empty
      // we still need to create a segment with xyz in p2
      // so that when we're being asked to /gotoline we have a position
      // for each gcode line, even comments. we just use the last real position
      // to give each gcode line (even a blank line) a spot to go to
      var args = {
        'cmd': 'empty or comment',
        'text': text,
        'origtext': origtext,
        'indx': info,
        'isComment': isComment
      };
      var handler = this.handlers['default'];
      return handler(args, info, this);
    }
  }

  this.parse = function (gcode) {
    var lines = gcode.split(/\r{0,1}\n/);
    for (var i = 0; i < lines.length; i++) {
      if (this.parseLine(lines[i], i) === false) {
        break;
      }
    }
  }
}
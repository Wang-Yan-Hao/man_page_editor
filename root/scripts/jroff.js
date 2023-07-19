/**
 * Jroff 0.0.1 <http://roperzh.github.io/jroff.js>
 * Copyright (c)2015 Roberto Dip <http://roperzh.com>
 * @license Distributed under MIT license
 * @module Jroff
 */

(function (root, factory) {
  if(typeof define === 'function' && define.amd) {
    // AMD module loader is available, define the module and its dependencies using define()
    define([], factory);
  } else if(typeof module === 'object' && module.exports) {
    // CommonJS environment (e.g., Node.js), export the module using module.exports
    module.exports = factory();
  } else {
    // Browser global scope, assign the module to the global object (root)
    root.Jroff = factory();
  }
}(this, function () { //eslint-disable-line max-statements, ESLint (JS format checker)
    "use strict"; // Enables a stricter set of rules for parsing and executing JavaScript code.

// Different attribute of each token (Token.kind). There is functions to check the text is what attribute (Token.isMacro(), Token.isComment ...).
var COMMENT = 1,
    MACRO = 2,
    IMACRO = 3, // Inline macro
    BREAK = 4,
    TEXT = 5,
    EMPTY = 6,
    ESCAPE = 7;

// Macro list. The macro has a callable function.
// This is used to check wheather the text is a inline macro (isInlineMacro function). So any inline macro you want to add must be add to this lis.
var callableMacros = [
  'Ac', 'Ao', 'Bc', 'Bo', 'Brc', 'Bro', 'Dc', 'Do', 'Ec', 'Eo', 'Fc',
  'Oc', 'Oo', 'Pc', 'Po', 'Qc', 'Qo', 'Sc', 'So', 'Xc', 'Xo', 'Aq',
  'Bq', 'Brq', 'Dq', 'Op', 'Pq', 'Ql', 'Qq', 'Sq', 'Vt', 'Ta', 'Ad',
  'An', 'Ap', 'Ar', 'At', 'Bsx', 'Bx', 'Cd', 'Cm', 'Dv', 'Dx', 'Em',
  'Er', 'Ev', 'Fa', 'Fl', 'Fn', 'Ft', 'Fx', 'Ic', 'Li', 'Lk', 'Ms',
  'Mt', 'Nm', 'Ns', 'Nx', 'Ox', 'Pa', 'Pf', 'Sx', 'Sy', 'Tn', 'Ux',
  'Va', 'Vt', 'Xr', "\\&",
];

/**
 * Wrap all common regexp patterns
 * 
 * This tag indicates that the patterns object is intended to serve as a namespace,
 * grouping related properties or functions together. It helps organize code and
 * provides a logical grouping for the patterns.
 * @namespace
 * This tag specifies an alias or alternative name for the patterns object. 
 * It allows the object to be referred to by a different name in the documentation. 
 * In this case, the alias is set to "patterns."
 * @alias patterns
 * Indicate the version
 * @since 0.0.1
 *
 */
// Use for isMacro function ...
var patterns = {
  // Pattern to match a macro at the beginning of a line
  macro: /^\./,
  
  // Pattern to match the start of a macro, allowing leading spaces
  macroStart: /^.\s*/,
  
  // Pattern to match a lexeme, which can be a newline, whitespace, or a macro followed by a non-whitespace character
  lexeme: /(\n|\s+|^\.\s+\S+)/g,
  
  // Pattern to match comments, which can be escaped quotes or escaped hash symbols
  comment: /(\.)?\\\"|\\#/,
  
  // Pattern to match arguments, which can be double-quoted strings or non-whitespace characters
  arguments: /"(.*?)"|\S+/g,
  
  // Pattern to match a single digit
  number: /[\d]/,
  
  // Pattern to match a real number, which can be a positive or negative integer at the beginning of a line
  realNumber: /(^[\-|\+]?\d)/,
  
  // Pattern to match escape sequences, starting with a backslash followed by any character except a double quote
  escape: /(\\[^\"])/g,
  
  // Pattern to match wrapping quotes at the start and end of a string, allowing optional leading and trailing spaces
  wrappingQuotes: /^\s*?\"([^\"]*)\"\s*?$/g,
  
  // Pattern to match any non-whitespace character
  noWhiteSpace: /\S/,
  
  // Pattern to match a new line, allowing optional leading spaces and tabs
  newLine: /[ \t]*\n/
};

/**
 * Create a new object with all the properties present in an array of n
 * objects.
 *
 * @argument {array} objects to be combined
 *
 * @returns {object} The merged object containing all properties from the input objects.
 *
 * @since 0.0.1
 *
 */
var mergeObjects = function (objects) {
  // Use the `reduce` method to iterate over the objects and accumulate them into a single object
  return objects.reduce(function (memo, object) {
    for(var key in object) {
      // Check if the property belongs to the object itself and not its prototype chain
      if(object.hasOwnProperty(key)) {
        // Assign the property value from the current object to the corresponding property in the `memo` object
        memo[key] = object[key];
      }
    }

    return memo;
  }, {});
};

/**
 * Returns a boolean describing if the token can have nodes
 *
 * @argument {token} token
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
// Modes is a collection of sub tokens, useful while parsing ( for example a macro with inline macros ).
var canHaveNodes = function (token) {
  // Check if the kind of the token is one of the specified values: MACRO, IMACRO, ESCAPE. So it have a sub node.
  return [MACRO, IMACRO, ESCAPE].indexOf(token.kind) !== -1
};

var macros = {}; // The macro map, key is the macro name and value is the funciton to extend that macro
var macroLib = null;

/**
 * Represents a single token, encapsulates common behavior useful
 * to parse and manipulate tokens
 *
 * @constructor
 * @alias Token
 *
 * @property {string} value
 *
 * @property {number} kind of the token, used to know if the token
 * represents a macro, break, inline macro, etc.
 *
 * @property {array} nodes is a collection of sub tokens, useful while
 * parsing ( for example a macro with inline macros ).
 *
 * @since 0.0.1
 *
 */
var Token = function (value, kind) {
  this.value = value || '';
  this.kind = kind || EMPTY;
  this.nodes = [];
};

/**
 * Class method used to know wheter a string represents a comment
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isComment = function (str) {
  return patterns.comment.test(str);
};

/**
 * Class method used to know wheter a string represents an empty line
 *
 * @param {string} str
 *
 * @returns {boolean}
 *Now, to preserve the line break and control the spacing, you can use CSS:


 * @since 0.0.1
 *
 */
Token.isEmptyLine = function (str) {
  return patterns.newLine.test(str);
};

/**
 * Class method used to know wheter a string represents an inline
 * macro
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isInlineMacro = function (str) {
  return callableMacros.indexOf(str) !== -1; // && macroLib === 'doc';
};

/**
 * Class method used to know wheter a string represents a macro
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isMacro = function (str) {
  return patterns.macro.test(str);
};

/**
 * Class method used to know wheter a string represents a escape sequence
 *
 * @param {string} str
 *
 * @returns {boolean}
 *
 * @since 0.0.1
 *
 */
Token.isEscape = function (str) { // Start with \
  return str.charAt(0) === '\\';
};

/**
 * Add a given token into the nodes array
 *
 * @param {Token} token
 *
 * @returns {Token} the token instance itself, useful for method
 * chaining
 *
 * @since 0.0.1
 *
 */
Token.prototype.addNode = function (token) {
  this.nodes.push(token);

  return this;
};

/**
 * Return the last node in the nodes array, if the array is empty,
 * safely return a new token of kind EMPTY
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Token.prototype.lastNode = function () {
  return this.nodes[this.nodes.length - 1] || new Token();
};

/**
 * Mix the given token with the current token instance.
 *
 * Mixing two tokens means to concatenate their values
 *
 * @param {Token} token
 *
 * @returns {Token} the token instance itself, useful for method
 * chaining
 *
 * @todo clarify the documentation and add examples
 *
 * @since 0.0.1
 *
 */
Token.prototype.mix = function (token) {
  this.value = this.value + token.value;

  if(this.kind === EMPTY) {
    this.kind = token.kind;
  }

  return this;
};

/**
 * Supplies an interface to create new Token instances based on a
 * string representation of the token, and returns a Token instance
 * with the correct `kind` attribute.
 * This constructor is meant to be instantiated.
 *
 * @constructor
 * @alias TokenFactory
 * @since 0.0.1
 *
 */
var TokenFactory = function () {};

/**
 * Creates a new Token with the correct kind based on a raw
 * representation of the token
 *
 * @param {string} [rawToken]
 *
 * @returns {Token} a new instance of the Token class
 *
 * @example
 * var factory = new TokenFactory();
 * var token = factory.create('.SH TITLE');
 * token.kind === MACRO; //=> true
 * token.value; //=> 'TITLE'
 *
 * @since 0.0.1
 *
 */
TokenFactory.prototype.create = function (rawToken) {
  var kind = TEXT;

  if(typeof rawToken === 'undefined') {
    kind = EMPTY;
  } else if(Token.isComment(rawToken)) {
    kind = COMMENT;
  } else if(Token.isMacro(rawToken)) {
    kind = MACRO;
  } else if(Token.isInlineMacro(rawToken)) {
    kind = IMACRO;
  } else if(Token.isEmptyLine(rawToken)) {
    kind = BREAK;
  } else if(Token.isEscape(rawToken)) {
    kind = ESCAPE;
  }

  return new Token(rawToken, kind);
};

/**
 * Takes charge of the process of converting a sequence of characters
 * (string) into a sequence of tokens. Also keeps track of useful
 * information like current column and line number during the process
 *
 * @constructor
 *
 * @property {array} source the source string, splitted by withespaces
 *
 * @property {array} tokens buffer to store the parsed tokens
 *
 * @property {integer} sourceIdx current token index
 *
 * @property {col} current column being parsed
 *
 * @property {line} current line being parsed
 *
 * @property {TokenFactory} factory used to create tokens
 *
 */
var Lexer = function (source) {
  this.source = this.cleanSource(source)
    .split(patterns.lexeme);
  this.tokens = [];
  this.sourceIdx = 0;
  this.col = 0;
  this.line = 1;
  this.factory = new TokenFactory();
};

/**
 * Performs the following tasks to the source string:
 * - Replaces < and > symbols with their HTML escape equivalents
 * - Adds whitespaces between escape sequences
 *
 * @argument {string} source
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
// Exampel: '<p>Hello, world!</p>' -> '&lt;p&gt; Hello, world! &lt;/p&gt'
Lexer.prototype.cleanSource = function (source) {
  return source
    .replace(patterns.escape, ' $1 ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Does the tokenization of the source given in the constructor,
 * and returns an array of tokens.
 *
 * @returns {array} array of tokens
 *
 * @example
 * var lexer = new Lexer(string);
 * lexer.lex() //=> [...]
 */
Lexer.prototype.lex = function () {
  var lexeme;

  /* This check is here because empty strings can break the loop */
  while(typeof (lexeme = this.next()) !== 'undefined') {
    this.tokens.push(this.factory.create(lexeme));
  }

  return this.tokens;
};

/**
 * Manages the current token being parsed,
 * and the state of this.col and this.line.
 *
 * @returns {string} the next lexeme in the source, if there is no
 * more lexemes returns `undefined`
 *
 */
Lexer.prototype.next = function () {
  var lexeme = this.source[this.sourceIdx++];

  if(lexeme === '\n') {
    this.col = 0;
    this.line += 1;
  } else if(lexeme) {
    this.col += lexeme.length;
  }

  return lexeme;
};

/**
 * Works out the grammatical structure of the token array provided
 * by the Lexer and generates an AST ready to be transformed, this
 * AST could be consumed by the HTML generator but it's not limited
 * to that.
 *
 * @constructor
 * @alias Parser
 *
 * @property {string} input raw contents of the man page
 *
 * @since 0.0.1
 *
 */
var Parser = function (input) {
  this.ast = [];
  this.scope = this.ast;
  this.lexer = new Lexer(input);
  this.tokens = this.lexer.lex();
  this.lastTok = new Token('', BREAK);
  this.escapeWithArguments = ['\\f', '\\s', '\\m', '\\('];

  this.mappings = {};
  this.mappings[MACRO] = 'handleMacro';
  this.mappings[IMACRO] = 'setNewScope';
  this.mappings[TEXT] = 'handleText';
  this.mappings[ESCAPE] = 'handleEscape';
  this.mappings[BREAK] = 'handleBreak';
  this.mappings[COMMENT] = 'ignore';
  this.mappings[EMPTY] = 'ignore';
};

/**
 * Return the next token in the lexer queue
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.next = function () {
  return this.tokens.shift();
};

/**
 * Add the last token into the scope, and set it as the last parsed
 * token
 *
 * @returns {Token}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.addToScope = function (token) {
  this.scope.push(token);
  this.lastTok = token;
};

/**
 * Go through all tokens in the lexer queue and return an AST
 * describing the relationship between them.
 *
 * @returns {array}
 *
 * @since 0.0.1
 *
 */
Parser.prototype.buildAST = function () {
  var token;

  while((token = this.next())) {
    this[this.mappings[token.kind]](token);
  }

  return this.ast;
};

/**
 * Handle macro tokens, if the last parsed token is a line break,
 * the token is a macro and it should call 'setNewScope', otherwise
 * it's a false positive (example: a period in a sentence) and it
 * should call 'handleText'
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleMacro = function (token) {
  if(this.lastTok.kind === BREAK) {
    /* Remove the starting dot and any whitespace */
    token.value = token.value.replace(patterns.macroStart, '');
    this.setNewScope(token);
  } else {
    this.handleText(token);
  }
};

/**
 * Used by macros and inline macros; this function changes the current
 * scope to the 'nodes' property of the current token
 *
 * @since 0.0.1
 *
 */
Parser.prototype.setNewScope = function (token) {
  this.addToScope(token);
  this.scope = token.nodes;
};

/**
 * Handles line breaks:
 *
 * - If the last parsed token is another line break, we should add a
 * 'br' token in order to emulate the groff behavior
 * - Otherwise the line break resets the scope to the default scope
 * (this.ast)
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleBreak = function (token) {
  this.scope = this.ast;

  if(this.lastTok.kind === BREAK) {
    this.scope.push(new Token('br', MACRO));
  } else {
    this.scope.push(new Token(' ', TEXT));
  }

  this.lastTok = token;
};

/**
 * Handles escape sequences, since any scape sequence will be in the
 * form: ESCAPE + SPACING + ARGUMENT ( check Lexer.js ) we are just
 * pushing the next two following tokens into the 'nodes' array of
 * the current token
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleEscape = function (token) {
  if(this.escapeWithArguments.indexOf(token.value) !== -1) {
    var escapeParam;

    this.next();
    escapeParam = this.next();
    escapeParam.kind = TEXT;
    token.nodes.push(escapeParam);
  }

  this.addToScope(token);
};

/**
 * Handles text:
 *
 * - if the value of the token is an empty string, just return.
 * - if the last parsed token is another text token, mix both
 * - if the last parsed token isn't another text token, this is the
 * first text token in the chain, so just add it to the current scope
 *
 * @since 0.0.1
 *
 */
Parser.prototype.handleText = function (token) {
  if(!token.value) {
    return;
  }

  token.kind = TEXT;

  if(this.lastTok.kind === TEXT) {
    this.lastTok.mix(token);
  } else {
    if(canHaveNodes(this.lastTok)) {
      token.value = token.value.trim();
    }

    this.addToScope(token);
  }
};

/**
 * Create a ghost scope, so all the content pushed in it will be
 * ignored, useful for comments
 *
 * @since 0.0.1
 *
 */
Parser.prototype.ignore = function (token) {
  this.scope = [];
  this.lastTok = token;
};

// Use for Lb macro, from /contrib/mandoc/lib.in file.
var libKey = {
  'lib80211': '802.11 Wireless Network Management Library (lib80211, -l80211)',
  'libalias': 'Packet Aliasing Library (libalias, -lalias)',
  'libarchive': 'Streaming Archive Library (libarchive, -larchive)',
  'libarm': 'ARM Architecture Library (libarm, -larm)',
  'libarm32': 'ARM32 Architecture Library (libarm32, -larm32)',
  'libbe': 'Boot Environment Library (libbe, -lbe)',
  'libbluetooth': 'Bluetooth Library (libbluetooth, -lbluetooth)',
  'libbsdxml': 'eXpat XML parser library (libbsdxml, -lbsdxml)',
  'libbsm': 'Basic Security Module Library (libbsm, -lbsm)',
  'libc': 'Standard C~Library (libc, -lc)',
  'libc_r': 'Reentrant C~Library (libc_r, -lc_r)',
  'libcalendar': 'Calendar Arithmetic Library (libcalendar, -lcalendar)',
  'libcam': 'Common Access Method User Library (libcam, -lcam)',
  'libcasper': 'Casper Library (libcasper, -lcasper)',
  'libcdk': 'Curses Development Kit Library (libcdk, -lcdk)',
  'libcipher': 'FreeSec Crypt Library (libcipher, -lcipher)',
  'libcompat': 'Compatibility Library (libcompat, -lcompat)',
  'libcrypt': 'Crypt Library (libcrypt, -lcrypt)',
  'libcurses': 'Curses Library (libcurses, -lcurses)',
  'libcuse': 'Userland Character Device Library (libcuse, -lcuse)',
  'libdevattr': 'Device attribute and event library (libdevattr, -ldevattr)',
  'libdevctl': 'Device Control Library (libdevctl, -ldevctl)',
  'libdevinfo': 'Device and Resource Information Utility Library (libdevinfo, -ldevinfo)',
  'libdevstat': 'Device Statistics Library (libdevstat, -ldevstat)',
  'libdisk': 'Interface to Slice and Partition Labels Library (libdisk, -ldisk)',
  'libdl': 'Dynamic Linker Services Filter (libdl, -ldl)',
  'libdm': 'Device Mapper Library (libdm, -ldm)',
  'libdwarf': 'DWARF Access Library (libdwarf, -ldwarf)',
  'libedit': 'Command Line Editor Library (libedit, -ledit)',
  'libefi': 'EFI Runtime Services Library (libefi, -lefi)',
  'libelf': 'ELF Access Library (libelf, -lelf)',
  'libevent': 'Event Notification Library (libevent, -levent)',
  'libexecinfo': 'Backtrace Information Library (libexecinfo, -lexecinfo)',
  'libfetch': 'File Transfer Library (libfetch, -lfetch)',
  'libfsid': 'Filesystem Identification Library (libfsid, -lfsid)',
  'libftpio': 'FTP Connection Management Library (libftpio, -lftpio)',
  'libform': 'Curses Form Library (libform, -lform)',
  'libgeom': 'Userland API Library for Kernel GEOM subsystem (libgeom, -lgeom)',
  'libgmock': 'GoogleMock library (libgmock, -lgmock)',
  'libgpio': 'General-Purpose Input Output (GPIO) library (libgpio, -lgpio)',
  'libgtest': 'GoogleTest library (libgtest, -lgtest)',
  'libhammer': 'HAMMER Filesystem Userland Library (libhammer, -lhammer)',
  'libi386': 'i386 Architecture Library (libi386, -li386)',
  'libintl': 'Internationalized Message Handling Library (libintl, -lintl)',
  'libipsec': 'IPsec Policy Control Library (libipsec, -lipsec)',
  'libiscsi': 'iSCSI protocol library (libiscsi, -liscsi)',
  'libisns': 'Internet Storage Name Service Library (libisns, -lisns)',
  'libjail': 'Jail Library (libjail, -ljail)',
  'libkcore': 'Kernel Memory Core Access Library (libkcore, -lkcore)',
  'libkiconv': 'Kernel-side iconv Library (libkiconv, -lkiconv)',
  'libkse': 'N:M Threading Library (libkse, -lkse)',
  'libkvm': 'Kernel Data Access Library (libkvm, -lkvm)',
  'libm': 'Math Library (libm, -lm)',
  'libm68k': 'm68k Architecture Library (libm68k, -lm68k)',
  'libmagic': 'Magic Number Recognition Library (libmagic, -lmagic)',
  'libmandoc': 'Mandoc Macro Compiler Library (libmandoc, -lmandoc)',
  'libmd': 'Message Digest (MD4, MD5, etc.) Support Library (libmd, -lmd)',
  'libmemstat': 'Kernel Memory Allocator Statistics Library (libmemstat, -lmemstat)',
  'libmenu': 'Curses Menu Library (libmenu, -lmenu)',
  'libmj': 'Minimalist JSON library (libmj, -lmj)',
  'libnetgraph': 'Netgraph User Library (libnetgraph, -lnetgraph)',
  'libnetpgp': 'Netpgp Signing, Verification, Encryption and Decryption (libnetpgp, -lnetpgp)',
  'libnetpgpverify': 'Netpgp Verification (libnetpgpverify, -lnetpgpverify)',
  'libnpf': 'NPF Packet Filter Library (libnpf, -lnpf)',
  'libnv': 'Name/value pairs library (libnv, -lnv)',
  'libossaudio': 'OSS Audio Emulation Library (libossaudio, -lossaudio)',
  'libpam': 'Pluggable Authentication Module Library (libpam, -lpam)',
  'libpanel': 'Z-order for curses windows (libpanel, -lpanel)',
  'libpcap': 'Packet capture Library (libpcap, -lpcap)',
  'libpci': 'PCI Bus Access Library (libpci, -lpci)',
  'libpmc': 'Performance Counters Library (libpmc, -lpmc)',
  'libppath': 'Property-List Paths Library (libppath, -lppath)',
  'libposix': 'POSIX Compatibility Library (libposix, -lposix)',
  'libposix1e': 'POSIX.1e Security API Library (libposix1e, -lposix1e)',
  'libppath': 'Property-List Paths Library (libppath, -lppath)',
  'libproc': 'Processor Monitoring and Analysis Library (libproc, -lproc)',
  'libprocstat': 'Process and Files Information Retrieval (libprocstat, -lprocstat)',
  'libprop': 'Property Container Object Library (libprop, -lprop)',
  'libpthread': 'POSIX Threads Library (libpthread, -lpthread)',
  'libpthread_dbg': 'POSIX Debug Threads Library (libpthread_dbg, -lpthread_dbg)',
  'libpuffs': 'puffs Convenience Library (libpuffs, -lpuffs)',
  'libquota': 'Disk Quota Access and Control Library (libquota, -lquota)',
  'libradius': 'RADIUS Client Library (libradius, -lradius)',
  'librefuse': 'File System in Userspace Convenience Library (librefuse, -lrefuse)',
  'libresolv': 'DNS Resolver Library (libresolv, -lresolv)',
  'librpcsec_gss': 'RPC GSS-API Authentication Library (librpcsec_gss, -lrpcsec_gss)',
  'librpcsvc': 'RPC Service Library (librpcsvc, -lrpcsvc)',
  'librt': 'POSIX Real-time Library (librt, -lrt)',
  'librtld_db': 'Debugging interface to the runtime linker Library (librtld_db, -lrtld_db)',
  'librumpclient': 'Clientside Stubs for rump Kernel Remote Protocols (librumpclient, -lrumpclient)',
  'libsaslc': 'Simple Authentication and Security Layer client library (libsaslc, -lsaslc)',
  'libsbuf': 'Safe String Composition Library (libsbuf, -lsbuf)',
  'libsdp': 'Bluetooth Service Discovery Protocol User Library (libsdp, -lsdp)',
  'libssp': 'Buffer Overflow Protection Library (libssp, -lssp)',
  'libstdthreads': 'C11 Threads Library (libstdthreads, -lstdthreads)',
  'libstdthreads': 'C11 Threads Library (libstdthreads, -lstdthreads)',
  'libSystem': 'System Library (libSystem, -lSystem)',
  'libsysdecode': 'System Argument Decoding Library (libsysdecode, -lsysdecode)',
  'libtacplus': 'TACACS+ Client Library (libtacplus, -ltacplus)',
  'libtcplay': 'TrueCrypt-compatible API library (libtcplay, -ltcplay)',
  'libtermcap': 'Termcap Access Library (libtermcap, -ltermcap)',
  'libterminfo': 'Terminal Information Library (libterminfo, -lterminfo)',
  'libthr': '1:1 Threading Library (libthr, -lthr)',
  'libufs': 'UFS File System Access Library (libufs, -lufs)',
  'libugidfw': 'File System Firewall Interface Library (libugidfw, -lugidfw)',
  'libulog': 'User Login Record Library (libulog, -lulog)',
  'libusbhid': 'USB Human Interface Devices Library (libusbhid, -lusbhid)',
  'libutil': 'System Utilities Library (libutil, -lutil)',
  'libvgl': 'Video Graphics Library (libvgl, -lvgl)',
  'libx86_64': 'x86_64 Architecture Library (libx86_64, -lx86_64)',
  'libxo': 'Text, XML, JSON, and HTML Output Emission Library (libxo, -lxo)',
  'libz': 'Compression Library (libz, -lz)'
}

// Use for Dt macro
var docSections = {
  1: 'General Commands Manual',
  2: 'System Calls Manual',
  3: 'Library Functions Manual',
  4: 'Kernel Interfaces Manual',
  5: 'File Formats Manual',
  6: 'Games Manual',
  7: 'Miscellaneous Information Manual',
  8: 'System Manager\'s Manual',
  9: 'Kernel Developer\'s Manual'
};
// Use for Dt macro, in freebsd mdoc not use.
var volumes = {
  'USD': 'User\'s Supplementary Documents',
  'PS1': 'Programmer\'s Supplementary Documents',
  'AMD': 'Ancestral Manual Documents',
  'SMM': 'System Manager\'s Manual',
  'URM': 'User\'s Reference Manual',
  'PRM': 'Programmer\'s Manual',
  'KM': 'Kernel Manual',
  'IND': 'Manual Master Index',
  'LOCAL': 'Local Manual',
  'CON': 'Contributed Software Manual'
};

// Use for Dt macro, the list of valid architectures varies by.
var architectures = [
  'alpha', 'acorn26', 'acorn32', 'algor', 'amd64', 'amiga', 'arc', 'arm26',
  'arm32', 'atari', 'bebox', 'cats', 'cesfic', 'cobalt', 'dreamcast',
  'evbarm', 'evbmips', 'evbppc', 'evbsh3', 'hp300', 'hp700', 'hpcmips',
  'i386', 'luna68k', 'm68k', 'mac68k', 'macppc', 'mips', 'mmeye', 'mvme68k',
  'mvmeppc', 'netwinder', 'news68k', 'newsmips', 'next68k', 'ofppc',
  'pc532', 'pmax', 'pmppc', 'powerpc', 'prep', 'sandpoint', 'sgimips', 'sh3',
  'shark', 'sparc', 'sparc64', 'sun3', 'tahoe', 'vax', 'x68k', 'x86_64'
];

// Use in Bf macro and Ef macro
var fontModes = {
  '-emphasis': 'i',
  '-literal': 'span',
  '-symbolic': 'strong',
  '<i></i>': 'i', // Em parameter
  '<span></span>': 'span', // Li parameter
  '<strong></strong>': 'strong' // Sy parameter
};

// Use in St macro, chage content with FreeBSD style
var abbreviations = {
  '-ansiC': 'ANSI X3.159-1989 ("ANSI C89")', // C language standards
  '-ansiC-89': 'ANSI X3.159-1989 ("ANSI C89")',
  '-isoC': 'ISO/IEC 9899:1990 ("ISO C90")',
  '-isoC-90': 'ISO/IEC 9899:1990 ("ISO C90")',
  '-isoC-amd1': 'ISO/IEC 9899/AMD1:1995 ("ISO C90, Amendment 1")',
  '-isoC-tcor1': 'ISO/IEC 9899/TCOR1:1994 ("ISO C90, Technical Corrigendum 1")',
  '-isoC-tcor2': 'ISO/IEC 9899/TCOR2:1995 ("ISO C90, Technical Corrigendum 2")',
  '-isoC-99': 'ISO/IEC 9899:1999 ("ISO C99")',
  '-isoC-2011': 'ISO/IEC 9899:2011 ("ISO C11")',
  '-p1003.1-88': 'IEEE Std 1003.1-1988 ("POSIX.1")', // POSIX.1 before the Single UNIX Specification
  '-p1003.1': 'IEEE Std 1003.1 ("POSIX.1")',
  '-p1003.1-90': 'ISO/IEC 9945-1:1990 ("POSIX.1")',
  '-iso9945-1-90': 'ISO/IEC 9945-1:1990 ("POSIX.1")',
  '-p1003.1b-93': 'IEEE Std 1003.1b-1993 ("POSIX.1")',
  '-p1003.1b': 'IEEE Std 1003.1b ("POSIX.1")',
  '-p1003.1c-95': 'IEEE Std 1003.1c-1995 ("POSIX.1")',
  '-p1003.1i-95': 'IEEE Std 1003.1i-1995 ("POSIX.1")',
  '-p1003.1-96': 'ISO/IEC 9945-1:1996 ("POSIX.1")',
  '-iso9945-1-96': 'ISO/IEC 9945-1:1996 ("POSIX.1")',
  '-xpg3': 'X/Open Portability	Guide Issue 3 ("XPG3")', // X/Open Portability Guide version 4 and related standards
  '-p1003.2': 'IEEE Std 1003.2 ("POSIX.2")',
  '-p1003.2-92': 'EEE Std 1003.2-1992 ("POSIX.2")',
  '-iso9945-2-93': 'ISO/IEC 9945-2:1993 ("POSIX.2")',
  '-p1003.2a-92': 'IEEE Std 1003.2a-1992 ("POSIX.2")',
  '-xpg4': 'X/Open Portability	Guide Issue 4 ("XPG4")',
  '-susv1': '', // Single UNIX Specification version 1 and related standards
  '-xpg4.2': 'X/Open Portability	Guide Issue 4, Version 2 ("XPG4.2")',
  '-xsh4.2': '',
  '-xcurses4.2': 'X/Open Curses Issue 4, Version 2 ("XCURSES4.2")',
  '-p1003.1g-2000': 'IEEE Std 1003.1g-2000 ("POSIX.1")',
  '-svid4': 'System V Interface	Definition, Fourth Edition ("SVID4")',
  '-susv2': 'Version 2 of the Single UNIX Specification ("SUSv2")', // Single UNIX Specification version 2 and related standards
  '-xbd5': 'X/Open Base Definitions Issue 5 ("XBD5")',
  '-xsh5': 'X/Open System Interfaces and Headers Issue 5 ("XSH5")',
  '-xcu5': 'X/Open Commands and Utilities Issue 5 ("XCU5")',
  '-xns5': 'X/Open Networking Services	Issue 5	("XNS5")',
  '-xns5.2': 'X/Open Networking Services	Issue 5.2 ("XNS5.2")',
  '-p1003.1-2001': 'IEEE Std 1003.1-2001 ("POSIX.1")', // Single UNIX Specification version 3
  '-susv3': 'Version 3 of the Single UNIX Specification ("SUSv3")',
  '-p1003.1-2004': 'IEEE Std 1003.1-2004 ("POSIX.1")',
  '-p1003.1-2008': 'IEEE Std 1003.1-2008 ("POSIX.1")', // Single UNIX Specification version 4
  '-susv4': '',
  '-ieee754': 'IEEE Std 754-1985', // Other	standards
  '-iso8601': 'ISO 8601',
  '-iso8802-3': 'ISO/IEC 8802-3:1989',
  '-ieee1275-94': 'IEEE Std 1275-1994	("Open Firmware")'
};

/**
 * Group all `doc` macros (FreeBSD mdco)
 * @namespace
 * @alias macros.doc
 * @since 0.0.1
*/
macros.doc = {
  /**
   * Store the document date in the buffer,
   * since this macro is neither callable nor parsed
   * we just store the verbatim value
   *
   * @param {string} date
   *
   * @since 0.0.1
   *
   */
  Dd: function (date) {
    this.buffer.date = ''; // Buffer date set to default
    var old_date = date; // Store the old date string
    date = this.parseArguments(date);
    
    if(date[0] == '$Mdocdate$' || old_date == '') { // .Dd $Mdocdate$ || .Dd (If no date string is given, the current date is used.)
      // Get today date
      const date_object = new Date();
      const year = date_object.getFullYear()
      var month = date_object.getMonth()
      const day = date_object.getDate()
      date_object.setMonth(month);
      month = date_object.toLocaleString('en-US', { month: 'long' });
      
      this.buffer.date = month + ' ' + day + ', ' + year;
    }
    else if(date.shift() == '$Mdocdate:') { // .Dd $Mdocdate: July 2 2018$
      var result = '';
      // Regular expression to match only numbers
      const numberRegex = /^[0-9]+$/;
      if(date.length == 3 && date[2].length == 5 && date[2][4] == '$' && numberRegex.test(date[2].slice(0,-1))) // The year must be number and length is 5
      result = date[0] + ' ' + date[1] + ', ' + date[2].slice(0,-1);
      else 
      result = old_date;
      
      this.buffer.date = result;
    }
    else{ // .Dd July 2, 2018
      this.buffer.date = old_date;
    }
  },
  
  /**
   * This should be the first command in a man page, not only
   * creates the title of the page but also stores in the buffer
   * useful variables: `title`, `section`, `date`, `source`
   * and `manual`
   *
   * @argument {string} args.title is the subject of the page,
   * traditionally in capitals due to troff limitations, but
   * capitals are not required in this implementation.
   * If ommited, 'UNTITLED' is used.
   *
   * @argument {string} args.section number, may be a number in the
   * range 1..9, mappings between numbers and section names are
   * defined in the 'docSections' namespace. The default value is
   * empty.
   *
   * @argument {string} args.volume name may be arbitrary or one of
   * the keys defined in the volumes namespace, defaults to LOCAL.
   *
   * If the section number is neither a numeric expression in the
   * range 1 to 9 nor one of the above described keywords, the third
   * parameter is used verbatim as the volume name.
   *
   * @returns {string} a representation of the header displayed by
   * groff
   *
   * @since 0.0.1
   *
   */
  Dt: function (args) {
    var sideText,
        midText,
        title,
        section,
        volume;
    
    /* Parse the arguments string */
    args = this.parseArguments(args); //.Dt FOO	9 i386
    title = args[0]; // FOO
    section = args[1]; // 9
    volume = args[2]; // i386
    /* Store arguments with default values in the buffer */
    this.buffer.title = title || 'UNTITLED';
    this.buffer.section = section || '';
    this.buffer.volume = volume || 'LOCAL';
    
    sideText = this.buffer.title;
    midText = this.buffer.volume;
    
    if(section) {
      sideText = this.buffer.title + '(' + this.buffer.section + ')';
      
      if(volumes[volume]) {
        midText = volumes[volume];
      } else if(architectures.indexOf(volume) !== -1) {
        midText = 'FreeBSD ' + docSections[this.buffer.section] + ' (' + volume + ')';
      } else if(docSections[this.buffer.section]) {
        midText = 'FreeBSD ' + docSections[this.buffer.section];
      }
    }
    this.buffer.sideText = sideText;
    this.buffer.midText = midText;
    return '';
  },

  /**
   * Store a value for the operating system in the buffer,
   * this value is used in the bottom left corner of the
   * parsed manpage.
   *
   * This macro is neither callable nor parsed.
   *
   * @param {string} os
   *
   * @since 0.0.1
   *
   */
  Os: function (os) {
    this.buffer.os = os || 'FreeBSD 14.0-CURRENT'; // Default use 14.0 current, but mandoc actually use -Ios argument or `uname`  
  },

  /**
   * The `.Nm' macro is used for the document title or subject name.
   * It has the peculiarity of remembering the first argument it
   * was called with, which should always be the subject name of
   * the page.  When called without arguments, `.Nm' regurgitates
   * this initial name for the sole purpose of making less work
   * for the author.
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Nm: function (args) {
    var result;
  
    this.buffer.name = this.buffer.name || args;
    result = args || this.buffer.name;
  
    return '<code class="Nm">' + result + '</code>';
  },

  /**
   * `.Nd' first prints `--', then all its arguments.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Nd: function (args) {
    return ' — ' + '<span class="Nd">' + args + '</span>';
  },

  /**
   * Defines a section header and a wrapper for the content that
   * comes next ( section tag ) indented with the default indent.
   *
   * Also stores in the buffer the current section name.
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Sh: function (args) {
    this.buffer.section = args;
    // this.buffer.sectionTags.push('section');
    args = this.parseArguments(args);
    var result = '</p></section><section class="Sh">' + '<h1 class="Sh" id="'
               + args.join('_') + '">'
               + '<a class="permalink" href="#' + args.join('_')
               + '">' + args.join(' ')
               + '</a></h1><p class="Pp">' 
    return result;
  },

  /**
   * Represent a subsection inside a section, creates a subtitle tag
   * with the contents of the `arg` variable
   *
   * @param {string} subtitle, from 1 to n words.
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ss: function (args) {
    args = this.parseArguments(args);
    var result = '</p></section><section class="Ss">' + '<h2 class="Ss" id="'
               + args.join('_') + '">'
               + '<a class="permalink" href="#' + args.join('_')
               + '">' + args.join(' ')
               + '</a></h2><p class="Pp">' 
    return result;
  },

  Sx: function (text) {
    return '<a class="Sx" href="#' + text + '">' + text + '</a>';
  },

  /**
   * The `.Xr' macro expects the first argument to be a manual page
   * name. The optional second argument, if a string
   * (defining the manual section), is put into parentheses.
   *
   * @argument {string} args.name name of the manual page
   *
   * @argument {string} args.number
   *
   * @argument {string} text the remaining text in the line
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Xr: function (args) {
    var name,
      number,
      text;

    args = this.parseArguments(args);

    name = args.shift() || '';
    number = args[0] ? '(' + args.shift() + ')' : '';
    text = args.join(' ') || '';

    return '<a class="Xr">' + name + ' ' + number + '</a>' + text;
  },

  Tg: function (args) {
    args = this.parseArguments(args)
    const key = args[0]; // Only care about first parameter
    if (key) {
      return '<mark id="' + key + '"></mark>';
    }
    return '';
  },

  /**
   * The `.Pp' paragraph command may be used to specify a line space
   * where necessary.
   *
   * Since raw text is just added to the stream, this function
   * only opens the paragraph, the closing is handled in the
   * generator
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Pp: function () {
    return '</p><p class="Pp">';
  },

  Bd: function (args) {
    var class_result = []
    args = this.parseArguments(args);
    var type = args[0];

    var Bd_map = {
      '-centered': 'Bd Pp',
      '-filled': 'Bd Pp', // Special case
      '-literal': 'Bd Pp Li',
      '-ragged': 'Bd Pp',
      '-unfilled': 'Bd Pp', // Special case
      'indent': 'Bd-indent',
      'indent-two': 'Bd-indent',
      'left': '',
      'right': 'Bd-indent',
      'center': 'Bd-indent',
      'compact': ''
    }
    
    // type argument
    if (type == '-centered' || type == '-filled' || type == '-ragged'){
      class_result.push(Bd_map[type]);
    }
    else if (type == '-unfilled' || type == '-literal') { // Special case
      class_result.push(Bd_map[type]);
      this.buffer.Bd_unfill = true;
    }
    else { // type not specified, bd is not useful here
      return;
    }

    // -offset and -compact argument
    if (args[1] == '-offset' && args[3] == '-compact') { // -offset width -compact
      var width = args[2] || ''
      if (width == 'indent' || width == 'indent-two' || width == 'left' || width == 'right' || width == 'center') {
        class_result.push(Bd_map[width]);
      }
      else if (width != '') {
        class_result.push('Bd-indent'); // Any string is Bd-indent
      }
    }
    else if (args[1] == '-offset' && args[2] == '-compact') { // -offset -compact
    }
    else if (args[1] == '-offset') { // -offset width or -offset
      var width = args[2] || ''
      if (width == 'indent' || width == 'indent-two' || width == 'left' || width == 'right' || width == 'center') {
        class_result.push(Bd_map[width]);
      }
      else if (width != '') {
        class_result.push('Bd-indent'); // Any string is Bd-indent
      }
    }
    else if (args[1] == '-compact') { // compact
    }

    if (this.buffer.Bd_unfill) { // Special case
      return '</p><div class="' + class_result.join(' ') + '">' + '<pre>';
    }
    else {
      return '</p><div class="' + class_result.join(' ') + '">';
    }
  },

  Ed: function () {
    if (this.buffer.Bd_unfill) {
      this.buffer.Bd_unfill = false;
      return '<pre><p class="Pp">';
    }
    return '</div><p class="Pp">';
  },

  D1: function (text) {
    return '<div class="Bd Bd-indent">' + text + '</div>'
  },

  Dl: function (text) {
    return '<div class="Bd Bd-indent"><code class="Li">' + text + '</code></div>'
  },
  
  /**
   * Quotes the argument literally
   * @arguments {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ql: function (text) {
    return '`' + '<code class="Li">' + text + '</code>' + '\'';
  },

  /**
   * Initiates several types of lists, they may be
   * nested within themselves and within displays.
   *
   * The list type is specified with the first argument provided
   *
   * In addition, several list attributes may be specified
   * such as the width of a tag, the list offset, and compactness.
   *
   * In this implementation, the macro stores in the buffer the
   * list type for later use within the It tag
   *
   * @param {string} args.type the type of the list,
   * for example -enum
   *
   * @returns {string}
   *
   *
   * @since 0.0.1
   *
   */
  Bl: function (args) { //  Bl	-type [-width val] [-offset val] [-compact] [col ...]
    var class_result = []
    args = this.parseArguments(args);
    var type = args[0];

    var Bl_map = { // tag and class
      '-bullet': 'ul Bl-bullet',
      '-column': 'table Bl-column', // Special
      '-dash': 'ul Bl-dash',
      '-diag': 'dl Bl-diag', // Special
      '-enum': 'ol Bl-enum',
      '-hang': 'dl Bl-hang',
      '-hyphen': 'ul Bl-dash',
      '-inset': 'dl Bl-inset', // Special
      '-item': 'ul Bl-item',
      '-ohang': 'dl Bl-ohang', // Special
      '-tag': 'dl Bl-tag', // Special

      '-compact': 'Bl-compact',

      'indent': 'div Bd-indent', // div tag must in the outer of Bl macro tag
      'indent-two': 'div Bd-indent',
      'left': '',
      'right': 'div Bd-indent',
      'center': 'div Bd-indent',
    }
    
    // // type argument
    // if (type == '-centered' || type == '-filled' || type == '-ragged'){
    //   class_result.push(Bd_map[type]);
    // }
    // else if (type == '-unfilled' || type == '-literal') { // Special case
    //   class_result.push(Bd_map[type]);
    //   this.buffer.Bd_unfill = true;
    // }
    // else { // type not specified, Bl is not useful here
    //   return;
    // }

    // // -offset and -compact argument
    // if (args[1] == '-offset' && args[3] == '-compact') { // -offset width -compact
    //   var width = args[2] || ''
    //   if (width == 'indent' || width == 'indent-two' || width == 'left' || width == 'right' || width == 'center') {
    //     class_result.push(Bd_map[width]);
    //   }
    //   else if (width != '') {
    //     class_result.push('Bd-indent'); // Any string is Bd-indent
    //   }
    // }
    // else if (args[1] == '-offset' && args[2] == '-compact') { // -offset -compact
    // }
    // else if (args[1] == '-offset') { // -offset width or -offset
    //   var width = args[2] || ''
    //   if (width == 'indent' || width == 'indent-two' || width == 'left' || width == 'right' || width == 'center') {
    //     class_result.push(Bd_map[width]);
    //   }
    //   else if (width != '') {
    //     class_result.push('Bd-indent'); // Any string is Bd-indent
    //   }
    // }
    // else if (args[1] == '-compact') { // compact
    // }

    // if (this.buffer.Bd_unfill) { // Special case
    //   return '</p><div class="' + class_result.join(' ') + '">' + '<pre>';
    // }
    // else {
    //   return '</p><div class="' + class_result.join(' ') + '">';
    // }
  },
  /**
   * Defines the end of a list
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  El: function () {
    this.buffer.lists.shift();

    return '</span></li></ul>';
  },

  /**
   * Items within the list are specified with the `.It'
   * item macro.
   *
   * Depending on the list type the macro could receive extra args
   *
   * @argument {string} args exact meaning depends on list type
   *
   * @returns {string}
   *
   * @todo complete this documentation explain how the text and the
   * styles work.
   *
   * @since 0.0.1
   *
   */
  It: function (args) {
    var list = this.buffer.lists[0],
      pre = list.isOpen ? '</span></li>' : '',
      tagStyles = '',
      tag = '',
      contentStyles = 'margin-bottom:2%;';

    list.isOpen = true;

    for(var i = list.flags.length - 1; i >= 0; i--) {
      switch(list.flags[i]) {
      case '-bullet':
        tag = '&compfn;';
        contentStyles += 'margin-left:5%;';
        break;

      case '-dash':
        tag = '&minus;';
        contentStyles += 'margin-left:5%;';
        break;

      case '-enum':
        list.prevTag = list.prevTag || 1;
        tag = (list.prevTag++) + '.';
        contentStyles += 'margin-left:5%;';
        break;

      case '-item':
        tag = '';
        contentStyles += 'margin-left:5%;';
        break;

      case '-tag':
        tag = args;
        tagStyles += 'display:inline-block;';
        contentStyles += 'margin-left:5%;';
        break;

      case '-hang':
        tag = this.generateTag('i', args);
        tagStyles += 'width:8%;display:inline-block;';
        contentStyles += 'margin-left:5%;';
        break;

      case '-ohang':
        tag = this.generateTag('strong', args);
        tagStyles += 'display:block;';
        contentStyles += 'display:inline-block';
        break;

      case '-inset':
        tag = this.generateTag('i', args);
        contentStyles += 'display:inline-block;';
        break;

      case '-compact':
        tagStyles += 'margin-bottom: 0;';
        contentStyles += 'margin-bottom:0;';
      }
    }
    return(
      pre + '<li><span style="' + tagStyles + '">' +
      tag + '</span> <span style="' + "display:inline-block;" + contentStyles + '">'
    );
  },
  Ta: function (text) {
    return this.generateTag('span', text);
  },

  /**
   * Reference start. Causes a line break in the SEE ALSO section
   * and begins collection of reference information until
   * the reference end macro is read.
   *
   * In practice, defines the references namespace in the buffer
   *
   * @since 0.0.1
   *
   */
  Rs: function () {
    this.buffer.references = {
      A: [], // %A macro
      T: [], // %T macro
      B: [], // %B macro
      I: [], // %I macro
      J: [], // %J macro
      R: [], // %R macro
      N: [], // %N macro
      V: [], // %V macro
      U: [], // %U macro
      P: [], // %P macro
      Q: [], // %Q macro
      C: [], // %C macro
      D: [], // %D macro
      O: [], // %O macro
    };
    return '<cite class="Rs">';
  },

  /**
   * Reference author name; one name per invocation.
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%A': function (name) {
    this.buffer.references.A.push(name);
  },

  /**
   * Reference book title
   *
   * @arguments {string} title
   *
   * @since 0.0.1
   *
   */
  '%B': function (title) {
    this.buffer.references.B.push(title);
  },

  '%C': function (location) {
    this.buffer.references.C.push(location); 
  },

  /**
   * Reference date asa raw string
   *
   * @arguments {string} date
   *
   * @since 0.0.1
   *
   */
  '%D': function (date) {
    this.buffer.references.D.push(date);
  },

  /**
   * Reference issue/publisher name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%I': function (name) {
    this.buffer.references.I.push(name);
  },
  /**
   * Reference journal name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%J': function (name) {
    this.buffer.references.J.push(name);
  },
  /**
   * Reference issue number
   *
   * @arguments {string} issue
   *
   * @since 0.0.1
   *
   */
  '%N': function (issue) {
    this.buffer.references.N.push(issue);
  },
  /**
   * Reference optional information
   *
   * @arguments {string} args
   *
   * @since 0.0.1
   *
   */
  '%O': function (args) {
    this.buffer.references.O.push(args);
  },
  /**
   * Reference page number
   *
   * @arguments {string} page
   *
   * @since 0.0.1
   *
   */
  '%P': function (page) {
    this.buffer.references.P.push(page);
  },
  /**
   * Reference corporate author
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%Q': function (name) {
    this.buffer.references.Q.push(name);
  },
  /**
   * Reference report name
   *
   * @arguments {string} name
   *
   * @since 0.0.1
   *
   */
  '%R': function (name) {
    this.buffer.references.R.push(name)
  },
  /**
   * Reference title of article
   *
   * @arguments {string} title
   *
   * @since 0.0.1
   *
   */
  '%T': function (title) {
    this.buffer.references.T.push(title)
  },
  /**
   * Reference volume
   *
   * @arguments {string} volume
   *
   * @since 0.0.1
   *
   */
  '%U': function (url) {
    this.buffer.references.U.push(url)
  },
  '%V': function (volume_number) {
    this.buffer.references.V.push(volume_number);
  },
  /**
   * Reference end, prints all the references. Uses special
   * treatement with author names, joining them with '&'
   *
   * @return {string}
   *
   * @since 0.0.1
   *
   */
  Re: function () {
    var result = ''
    const tagMap = {
      'T': 'span',
      'B': 'i',
      'I': 'i',
      'J': 'i',
      'R': 'span',
      'N': 'span',
      'V': 'span',
      'P': 'span',
      'Q': 'span',
      'C': 'span',
      'D': 'span',
      'O': 'span',
    }

    for (var key in this.buffer.references) {
      const value_index = this.buffer.references[key];
      if (key == 'A') {
        if (value_index.length == 1)
          result += '<span class="RsA">' + value_index[0] + '</span>';
        else if (value_index.length == 2)
          result += '<span class="RsA">' + value_index[0] + '</span>'
                + ' and ' + '<span class="RsA">' + value_index[1] + '</span>';
        else if (value_index.length > 2)
          for (var i = 0; i < value_index.length; i++) {
            if (i != value_index.length - 2)
              result += '<span class="RsA">' + value_index[i] + '</span>' + ', '
            else 
              result += '<span class="RsA">' + value_index[i] + '</span>'
                      + ', and ' + '<span class="RsA">' + value_index[++i] + '</span>';
          }
      }
      else if (key == 'U') {
        for (var i = 0; i < value_index.length; i++) {
          const value = value_index[i]
          var link = '<a class="RsU" href="' + value + '">' + value + '</a>';
          result += ', ' + link;
        }
      }
      else 
        for (var i = 0;i < value_index.length; i++) 
          result += ', ' + '<' + tagMap[key] + ' class="Rs' + key + '">' + value_index[i] + '</' + tagMap[key] + '>';
    }

    return result + '.' + '</cite>';
  },

  /**
   * Suppresses the whitespace between its first and second argument
   *
   * @argument {string} args
   *
   * @since 0.0.1
   *
   */
  Pf: function (args) {
    args = this.parseArguments(args);
    return args.shift() + args.shift() + ' ' + args.join(' ');
  },

  Ns: function (text) {
    return text;
  },

  Ap: function (text) {
    return '\'' + text;
  },

  Sm: function () { // Not recommend to use, not implement now
    
  },

  Bk: function (args) { // In pratical it do nothing

  },

  Ek: function () { // In pratical it do nothing
  },

  /**
   * The `.Fl' macro handles command line flags, it prepends
   * a dash, `-', to the flag and makes it bold.
   *
   * A call without any arguments results in a dash representing
   * stdin/stdout
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Fl: function (args) {
    args = this.parseArguments(args);
    var result = ''
    if(args.length == 0) 
      result += '<code class="Fl">' + '-' + '</code>';
    else {
      for (var value of args) {
        result += '<code class="Fl">' + '-' + value + '</code>' + ' ';
      }
    }
    return result;
  },

  /**
   * The command modifier is identical to the `.Fl' (flag) command
   * with the exception that the `.Cm' macro does not assert a dash
   * in front of every argument.
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Cm: function (args) {
    return '<code class="Cm">' + args + '</code>';
  },

  /**
   * The .Ar argument macro may be used whenever afn argument
   * is referenced. If called without arguments,
   * the `file ...' string is output.
   *
   * Generally prints text in italic format
   *
   * @param {string} argument
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ar: function (args) {
    args = args || 'file ...';
    return '<var class="Ar">' + args + '</var>';
  },

  /**
   * The `.Op' macro places option brackets around any remaining
   * arguments on the command line
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Op: function (args) {
    return '[' + args + ']';
  },

  /**
   * Prints an opening bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Oo: function (args) {
    if (!args) {
      return '[';
    }
    else {
      return '[' + args;
    }
  },

  /**
   * Prints a closing bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Oc: function () {
    return ']';
  },

  Ic: function (text) {
    return '<code class="Ic">' + text + '</code>';
  },

  /**
   * Especifies an environment variable,
   * in practical terms, it only returns the text in normal format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ev: function (args) {
    return '<code class="Ev">' + args + '</code>';
  },

  /**
   * Formats path or file names.  If called without arguments,
   * the `~' string is output, which represents the current user's
   * home directory.
   *
   * @arguments {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Pa: function (args) {
    args = args || '~';

    return '<span class="Pa">' + args + '</span>';
  },

  Lb: function (text) {
    text = this.parseArguments(text);
    var result = ''
    if(libKey[text[0]]) 
      result += libKey[text.shift()] + text.join(' ');
    else
      result += 'library ' + '"' + text.shift() + '" ' + text.join(' ');

    return '<span class="Lb">' + result + '</span>';
  },

  In: function (text) {
    text = this.parseArguments(text);
    var result = ''
    if(this.isInsideOfSection('SYNOPSIS')) 
      result += '#include &lt;' + text.shift() + '&gt;';
    else 
      result += '&lt;' + text.shift() + '&gt; ';

    return '<code class="In">' + result + '</code>' + ' ' +  text.join(' ');
  },

  Fd: function (text) {
    return '<code class="Fd">' + text + '</code>';
  },

  Ft: function (name) {
    return '<var class="Ft">' + name + '</var>';
  },

  Fo: function (name) {
    // this.buffer.functionArgs = [];
    // this.buffer.functionName = '<strong>' + name.split(' ')[0] + '</strong>'; // Only get the first name
    this.buffer.InFoMacro = true;
    name = this.parseArguments(name)[0]; // Only care about first parameter
    var result = ''

    if (name)
      result += '<a class="permalink" href="#' + name + '">' +
                '<code class="Fn" id="' + name + '">' + name + '</code>' +
                '</a>';
    
    return result + '(';
  },

  /**
   * Closes the multi parameter funcion definition and prints the
   * result
   *
   * Behind the covers this function only formats the params and then
   * calls .Ft
   *
   * @return {string}
   *
   * @since 0.0.1
   *
   */
  Fc: function () {
    // var args = this.buffer.functionArgs.join(', '),
    //   callParams = this.buffer.functionName + ' "' + args + '"';
    this.buffer.InFoMacro = false;
    // return '<br>' + macros.doc.Fn.call(this, callParams);
    return ');';
  },

  /**
   * Prints a function signature, with the function name in bold
   * if no arguments are provided, returns an empty string
   *
   * @argument {string} args.name function name
   *
   * @argument {string} args.params function params
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Fn: function (args) {
    args = args.split('"');
    args = args.filter(item => item !== '' && item !== ' ');

    if(!args[0]) // No parameter, no work
      return '';
    
    var first_parameter_array = args.shift().split(' ');

    var funcName = first_parameter_array[first_parameter_array.length - 1];
    first_parameter_array.pop()

    var funcType = first_parameter_array.join(' ');

    var funcTypeTag = ''
    var funcNameTag = ''
    if (funcType)
      funcTypeTag = '<var class="Ft">' + funcType + '</var>';
    if (funcName)
    funcNameTag = '<a class="permalink" href="#' + funcName + '">' +
                  '<code class="Fn" id="' + funcName + '">' + funcName + '</code>' +
                  '</a>';
    
    var result = '';
    var flag = true;
    for (var value of args) {
      if (value != ' ' && value != ''){
        if (flag) {
          result += '<var class="Fa">' + value + '</var>';
          flag = false
        }
        else {
          result += ', <var class="Fa">' + value + '</var>';
        }
      }
    }

    return funcTypeTag + ' ' + funcNameTag + '(' + result + ')';
  },

  /**
   * Stores in the buffer a function argument
   *
   * @since 0.0.1
   *
   */
  Fa: function (arg) {
    var result = ''
    if (this.buffer.InFoMacro) {
      arg = arg.split('"');
      var flag = true;
      for (var value of arg) {
        if (value != ' ' && value != ''){
          if (flag) {
            result += '<var class="Fa">' + value + '</var>';
            flag = false
          }
          else {
            result += ', <var class="Fa">' + value + '</var>';
          }
        }
      }
    }
    else {
      result += '<var class="Fa">' + arg.replace(/"/g, '') + '</var>';
    }
    return result;
  },

  /**
   * Prints the provided text in italics, if its called inside of the
   * SYNOPSIS section it also adds a line break
   *
   * @argument {string}
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Vt: function (args) {
    if (this.isInsideOfSection('SYNOPSIS'))
      return '<br><var class="Vt">' + args + '</var>';
    else 
      return '<var class="Vt">' + args + '</var>';
  },

  /**
   * References variables, print the provided arguments in italics
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Va: function (args) {
    return '<var class="Va">' + args + '</var>';
  },
  
  /**
   * Defines a variable, in practical terms, it only returns the text
   * in normal format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Dv: function (args) {
    return '<code class="Dv">' + args + '</code>';
  },

  Er: function (args) {
    return '<code class="Er">' + args + '</code>';
  },

  /**
   * The `.An' macro is used to specify the name of the author
   * of the item being documented, or the name of the author of
   * the actual manual page.
   *
   * Generally prints text in regular format
   *
   * @param {string} author
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  An: function (author) {
    return '<span class="An">' + author + '</span>';
  },

  Lk: function (text) {
    text = this.parseArguments(text);
    if (text.length == 0)
      return ' ';
    else if(text.length == 1)
      return '<a class="Lk" href="' + text[0] + '">' + text[0] + '</a>';
    else
      return '<a class="Lk" href="' + text.shift() + '">' + text.join(' ') + '</a>';
  },

  Mt: function (text) {
    text = this.parseArguments(text);
    var result = '';
    var t;
    while(t = text.shift())
      result += '<a class="Mt" href="' + t + '">' + t + '</a> ';
    
    return result;
  },

  /**
   * The `.Cd' macro is used to demonstrate a config
   * declaration for a device interface in a section four manual.
   *
   * In the SYNOPSIS section a `.Cd' command causes a line break
   * before and after its arguments are printed.
   *
   * Generally prints text in bold format
   *
   * @param {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Cd: function (args) {
    if (this.isInsideOfSection('SYNOPSIS'))
      return '<br><code class="Cd">' + args + '</code>';
    else 
      return '<code class="Cd">' + args + '</code>';
  },

  /**
   * The address macro identifies an address construct,
   * it's generally printed as a italic text.
   *
   * @param {string} address
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Ad: function (args) {
    return '<span class="Ad">' + args + '</span>';
  },

  Ms: function (args) {
    return '<span class="Ms">' + args + '</span>';
  },

  /**
   * Text may be stressed or emphasized with this macro, in practice,
   * the macro prints italic text
   *
   * @argument {string} text to be italized
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Em: function (text) {
    text = this.parseArguments(text);
    if (text.length == 0)
      return ' ';
    else
      return '<a class="permalink" href="#' + text[0] + '">' + '<i class="Em" id="' + text[0] + '">' + text.join(' ') + '</i></a>';
  },

  /**
   * Represents symbolic emphasis, prints the provided arguments
   * in boldface
   *
   * @argument {string} args
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Sy: function (args) {
    if (args)
      return '<b class="Sy">' + args + '</b>';
    else
      return ' ';
  },

  No: function (args) {
    return '<span class="No">' + args + '</span>';
  },

  /**
   * Start the font mode until .Ef is reached, receives a font mode
   * flag as a parameter; valid font modes are:
   *
   * - `-emphasis` Same as .Em macro
   * - `-literal`  Same as .Li macro
   * - `-symbolic` Same as .Sy macro
   *
   * Font modes and their tags are listed in the `fontModes` object.
   *
   * @argument {string} mode mode to be used
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Bf: function (mode) {
    const Bf_mode = {
      '-emphasis': 'Em',
      '-literal': 'Li',
      '-symbolic': 'Sy'
    }
    mode = this.parseArguments(mode)[0];
    var tag = Bf_mode[mode] || 'Bf No';

    return '<div class="' + tag + '">';
  },

  /**
   * Stop the font mode started with .Bf
   *
   * @since 0.0.1
   *
   */
  Ef: function () {

    return '</div>';
  },

  /**
   * Encloses in double quotes a given text
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Dq: function (args) {
    return '"' + args + '"';
  },

  /**
   * Prints an opening double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Do: function (args) {
    return '"' + args;
  },

  /**
   * Prints a closing double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Dc: function (args) {
    if (args)
      return '"' + ' ' + args;
    else
      return '"';
  },

  /**
   * Encloses a text in straight double quotes
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qq: function (args) {
    return '"' + args + '"';
  },

  /**
   * Prints a straight double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qo: function (args) {
    return '"' + args;
  },

  /**
   * Prints a straight double quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Qc: function (args) {
    if (args)
      return '"' + ' ' + args;
    else
      return '"';
  },

  /**
   * Encloses text in straight single quotes
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Sq: function (args) {
    return '\'' + args + '\'';
  },

  /**
   * Prints a straight single qoute
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  So: function (args) {
    return '\'' + args;
  },

  /**
   * Prints a straight single quote
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Sc: function (args) {
    if (args)
      return '\'' + ' ' + args;
    else
      return '\'';
  },

  /**
   * Encloses the given text in parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Pq: function (args) {
    return '(' + args + ')';
  },

  /**
   * Prints an open parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Po: function (args) {
    return '(' + args;
  },

  /**
   * Prints a closing parenthesis
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Pc: function (args) {
    if (args)
      return ')' + ' ' + args;
    else
      return ')';
  },

  /**
   * Encloses in brackets the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bq: function (args) {
    return '[' + args + ']';
  },

  /**
   * Prints an opening bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bo: function (args) {
    return '[' + args;
  },

  /**
   * Prints a closing bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bc: function (args) {
    if (args)
      return ']' + ' ' + args;
    else
      return ']';
  },

  /**
   * Encloses in braces the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Brq: function (args) {
    return '{' + args + '}';
  },

  /**
   * Prints an opening brace
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Bro: function (args) {
    return '{' + args;
  },

  /**
   * Prints a closing brace
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Brc: function (args) {
    if (args)
      return '}' + ' ' + args;
    else
      return '}';
  },

  /**
   * Encloses in angle brackets the given text
   *
   * @argument {string} args text to be enclosed
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Aq: function (args) {
    return '&lt;' + args + '&gt;';
  },

  /**
   * Prints an opening angle bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ao: function (args) {
    return '&lt;' + args;
  },

  /**
   * Prints a closing angle bracket
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ac: function (args) {
    if (args)
      return '&gt;' + ' ' + args;
    else
      return '&gt;';
  },

  /**
   * Prints XX
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Eo: function (args) {
    args = this.parseArguments(args);
    return args.shift() + args.join(' ');
  },

  /**
   * Prints XX
   *
   * @retuns {string}
   *
   * @since 0.0.1
   *
   */
  Ec: function (args) {
    return args;
  },

  Ex: function (args) { // Ex -std [utility ...]
    args = this.parseArguments(args);
    // args[0] may be '-std'
    if(args[0] == '-std')
      args.shift();

    if (args.length == 0) // Default to .Nm name
      args.push(this.buffer.name);

    var post = ' utility exits '
    var result = ''
    if (args.length == 1)
      result += 'The <code class="Nm">' + args[0] + '</code>';
    else if (args.length == 2){
      result += 'The <code class="Nm">' + args[0] + '</code>'
            + ' and ' + '<code class="Nm">' + args[1] + '</code>';

      post = ' utilities exit '
    }
    else if (args.length > 2){
      result += 'The <code class="Nm">' + args[0] + '</code>';
      for (var i = 1; i < args.length; i++) {
        if (i != args.length - 1)
          result += ', ' + '<code class="Nm">' + args[i] + '</code>' ;
        else 
          result += ', and ' + '<code class="Nm">' + args[i] + '</code>';
      }
      post = ' utilities exit '
    }

    const post_2 = '0 on success, and >0 If an error occurs.';
    return result + post + post_2;
  },

  Rv: function (args) { // Rv	-std [function ...]
    args = this.parseArguments(args);
    // args[0] may be '-std'
    if(args[0] == '-std')
      args.shift();

    if (args.length == 0) // Default
      return 'Upon successful completion, the value&nbsp;0 is returned; otherwise the value&nbsp; \
      -1 is returned and the global variable <var class="Va">errno</var> is set to indicate the error.</p>'
    

    var post = ' function returns '
    var result = ''
    if (args.length == 1)
      result += 'The <code class="Fn">' + args[0] + '</code>' + '()';
    else if (args.length == 2){
      result += 'The <code class="Fn">' + args[0] + '</code>'+ '()'
            + ' and ' + '<code class="Fn">' + args[1] + '</code>' + '()';

      post = ' functions return '
    }
    else if (args.length > 2){
      result += 'The <code class="Fn">' + args[0] + '</code>' + '()';
      for (var i = 1; i < args.length; i++) {
        if (i != args.length - 1)
          result += ', ' + '<code class="Fn">' + args[i] + '</code>' + '()';
        else 
          result += ', and ' + '<code class="Fn">' + args[i] + '</code>' + '()';
      }
      post = ' functions return '
    }

    const post_2 = 'return the value 0 if successful; otherwise the value -1 is returned and the global variable <var class="Va">errno</var> is set to indicate the error.'
    return result + post + post_2;
  },

  /**
   * Replaces standard abbreviations with their formal names.
   * Mappings between abbreviations and formal names can be found in
   * the 'abbreviations' object
   *
   * If the abbreviation is invalid, nothing is printed.
   *
   * @arguments {string} args abbreviation
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  St: function (args) {
    var cont = '';
    args = this.parseArguments(args);
    var first_arg = args.shift();
    if(abbreviations[first_arg]) 
      cont = '<span class="St">' + abbreviations[first_arg] + '</span>';
    
    return cont + ' ' + args.join(' ');
  },

  /**
   * Prints 'AT&T UNIX' and prepends the version number if provided
   *
   * @argument {string} version the version number
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  At: function (version) {
    var base = ' AT&amp;T UNIX';
    version = this.parseArguments(version);
    const regex_1 = /v[1-7]/;
    const regex_2 = /V.[1-4]/;

    if(version.length >= 1 && version[0] != ''){
      var key = version.shift();
      if (regex_1.test(key)) {
        base = 'Version ' + key[1] + ' ' + base; 
      }
      else if (key == '32v') {
        base = 'Version 7 AT&amp;T UNIX/32V';
      }
      else if (key == 'III') {
        base = 'AT&amp;T System III UNIX';
      }
      else if (key == 'V') {
        base = 'AT&amp;T System V UNIX';
      }
      else if (regex_2.test(key)) {
        base = 'AT&amp;T System V Release ' + key[2] + ' UNIX';
      }
      else {
        base = base + ' ' + key;
      }     
      return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
    }
    else {
      return '';
    }
  },

  /**
   * Prints 'BSD' and prepends the version number if provided, also
   * if the -devel flag is provided, print a default text
   *
   * @argument {string} version the version number
   *
   * @returns {string}
   *
   * @since 0.0.1
   *
   */
  Bx: function (version) {
    var base = 'BSD';
    version = this.parseArguments(version);
    base = (version.shift() || '') + base + (version[0] ? ('-' + version.shift()) : '');

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  Bsx: function (version) {
    version = this.parseArguments(version);
    var base = 'BSD/OS' + ' ' + version.shift();

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  /**
   * Prints NetBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Nx: function (version) {
    version = this.parseArguments(version);
    var base = 'NetBSD' + ' ' + version.shift();

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  /**
   * Prints FreeBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Fx: function (version) {
    version = this.parseArguments(version);
    var base = 'FreeBSD' + ' ' + version.shift();

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  /**
   * Prints OpenBSD and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Ox: function (version) {
    version = this.parseArguments(version);
    var base = 'OpenBSD' + ' ' + version.shift();

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  /**
   * Prints DragonFly and appends the version number if provided
   *
   * @argument {string} version
   *
   * @since 0.0.1
   *
   */
  Dx: function (version) {
    version = this.parseArguments(version);
    var base = 'DragonFly' + ' ' + version.shift();

    return '<span class="Ux">' + base + '</span>' + ' ' + version.join(' ');
  },

  "\\&": function (text) {
    return text;
  },

  "\\e": function (text) {
    return this.generateTag('span', '\\');
  },

  'br': function () {
    if (this.buffer.Bd_unfill)
      return '&#10;';
    else
      return '</p><p class="Pp">';
  },

  // Other macro not use in FreeBSD
  // /**
  //  * Encloses a given text in XX
  //  *
  //  * @retuns {string}
  //  *
  //  * @since 0.0.1
  //  *
  //  */
  // Eq: function (args) {
  //   return this.generateTag('span', 'XX' + args + 'XX');
  // },
  // /**
  //  * Prints BSD/OS and appends the version number if provided
  //  *
  //  * @argument {string} version
  //  *
  //  * @since 0.0.1
  //  *
  //  */
  // Osx: function (version) {
  //   return this.generateTag('span', 'BSD/OS ' + version);
  // },
  // /**
  //  * Prints UNIX
  //  *
  //  * @since 0.0.1
  //  *
  //  */
  // Ux: function () {
  //   return this.generateTag('span', 'UNIX');
  // },
  // /**
  //  * Prints its arguments in a smaller font.
  //  *
  //  * @argument {string} args
  //  *
  //  * @returns {string}
  //  *
  //  * @since 0.0.1
  //  *
  //  */
  // Tn: function (args) {
  //   return this.generateTag('small', args);
  // },
  // /**
  //  * May be used for special characters, variable con-
  //  * stants, etc. - anything which should be displayed
  //  * as it would be typed.
  //  *
  //  * @argument {string} args
  //  *
  //  * @returns {string}
  //  *
  //  * @todo check this implementation once we handle escaped chars
  //  *
  //  * @since 0.0.1
  //  *
  //  */
  // Li: function (args) {
  //   return this.generateTag('span', args);
  // },
  // Ap: function (text) {
  //   return this.generateTag('span', text);
  // },
};
var HTMLGenerator = function () {};

HTMLGenerator.prototype.generate = function (source, lib) { // lib parameter is not use now, this is use when you have different macros, but in this we only have one macro
  var parser,
    ast;

  if(!source) {
    return '';
  }

  parser = new Parser(source);
  ast = parser.buildAST();
  // lib = lib || 'doc';
  lib = 'doc'; // Only set to 'doc' macro, this is also our only macro (FreeBSD mdoc)
  console.log(ast)
  this.macros = mergeObjects([macros.defaults, macros[lib]]);

  /* Global variable, used to define if a token is imacro */
  // macroLib = lib;
  macroLib = 'doc';  // Only set to doc macro, this is also our only macro

  // Buffer to store the message while parsing
  this.buffer = {
    date: '', // Use for Dd macro
    os: '', // Use for Os macro
    title: '', // Use for Dt macro
    section: '', // Use for Dt macro
    volume: '', // Use for Dt macro
    sideText: '', // Use for Dt macro
    midText: '', // Use for Dt macro
    style: { // All macro
      indent: 8, // Default set the tab sapce, ex the text below .Sh macro. The unit is %
      fontSize: 16 // Defaul set the font size
    },
    section: '', // Use for Sh macro
    subSection: '', // Use for Ss macro
    openTags: [], // Use for Pp macro
    display: [], // Use for Bd, Ed macro
    lists: [], // Use for Bl, El macro
    references: {}, // Rs macro
    fontModes: [],
    sectionTags: [],
    activeFontModes: [], // Use fo Bf Ef macro
    InFoMacro: false, // Use for Fo Fc macro
    Bd_unfill: false, // Use for Bd macro
  };

  var ast_recurese = this.recurse(ast, 0);

  var begin = '<meta charset="utf-8"> \
               <meta name="viewport" content="width=device-width, initial-scale=1.0">'
  
  var top_1 = '<table class="head"> \
                  <tbody> \
                    <tr> \
                      <td class="head-ltitle">'
  var top_2 = '</td><td class="head-vol">'
  var top_3 = '</td><td class="head-rtitle">'
  var top_4 = '</td> \
                      </tr> \
                    </tbody> \
                  </table>'
  var top = top_1 + this.buffer.sideText 
          + top_2 + this.buffer.midText 
          + top_3 + this.buffer.sideText
          + top_4;

  var content_1 = '<div class="manual-text">' 
  var content_2 = '</div>'
  var content = content_1 + ast_recurese 
              + content_2;
  
  var end_1 = '<table class="foot"> \
                <tbody> \
                  <tr> \
                    <td class="foot-date">'
  var end_2 = '</td> <td class="foot-os">'
  var end_3 = '</td> \
                </tr> \
                </tbody> \
              </table>'
  var end = end_1 + this.buffer.date 
          + end_2 + this.buffer.os
          + end_3;
    
            
  // Post process

  // 2. Remove the space of Do, Dc, Qo, Qc, So, Sc, Po, Pc
  return begin + top + content + end;
};

/**
 * Fires the recursive generation of the HTML based on the
 * AST hierarchy, uses the native reduce function
 *
 * @param {array} arr of tokens
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.recurse = function (arr, layer) {
  return arr.reduce((result, node) => this.reduceRecursive(result, node, layer), '');
  // return arr.reduce(this.reduceRecursive.bind(this), '', 'layer');
};

/**
 * Meant to be used as an auxiliar function for the reduce call
 * in 'this.recurse'
 *
 * @param {string} result
 *
 * @param {token} node
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.reduceRecursive = function (result, node, layer) { // result is current local parsing result, node is current node
  var func,
    args;

  if(canHaveNodes(node)) { // Only escape, inline macro and macro can have node
    if(node.value === 'Sh' || node.value === 'SH') {
      result += this.closeAllTags(this.buffer.fontModes);
      result += this.closeAllTags(this.buffer.openTags);
    }
    func = this.macros[node.value] || this.undefMacro; // Get the macro parsing 
    args = node.nodes.length ? this.recurse(node.nodes, layer+1) : ''; // Get argument begind the macro now
    // console.log('Macro:', node.value, 'Args:', args);
    result += func.call(this, args, node) || '';
  } else {
/*     if (this.buffer.Bd_unfill == true) {
      if(node.value == ' ') {
        result += '<br>'
      }
      else {
        result += '<span style="white-space: pre;">' + node.value + '</sapn>';
      }
      console.log('Bd_uunfill:', node.value);
    }

    if (node.value != ' ' && layer == 0)
      result += '<p class="Pp">' + node.value + '</p>';
    else */
    if (this.buffer.Bd_unfill && node.value == ' ')
      result += '&#10;';
    else
      result += this.cleanQuotes(node.value); // If not macro, clean the " character
  }
  // console.log('Result: ',result)
  return result;
};

/**
 * Fallback function for undefined macros
 *
 * @param {string} args
 *
 * @param {token} node
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.undefMacro = function (args, node) {
  console.warn('Unsupported macro:', node.value);
  return args;
};

/**
 * Remove wrapping double quotes from a string
 *
 * @param {string} str
 *
 * @returns {string} the given argument without wrapping quotes
 *
 * @example
 * cleanQuotes('"Lorem Ipsum"'); //-> 'Lorem Ipsum'
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.cleanQuotes = function (str) {
  return str.replace(patterns.wrappingQuotes, '$1');
};

/**
 * Generate valid HTML tags
 *
 * @param {string} name tag name, this can also be a nested tag
 * definition, so 'p>a' is a valid name and denotes a `p` tag
 * wrapping an `a` tag.
 *
 * @param {string} content the content inside the tag
 *
 * @param {object} properties valid HTML properties
 *
 * @returns {string}
 *
 * @alias generateTag
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.generateTag = function (name, content) {
  var tags = name.split('>'),
    i = -1,
    openingTags = '',
    closingTags = '';

  while(tags[++i]) {
    openingTags += '<' + tags[i] + '>';
  }

  while(tags[--i]) {
    closingTags += '</' + tags[i] + '>';
  }

  return openingTags + content + closingTags;
};

/**
 * Given two tags names, this function generates a chunk of HTML
 * with the content splitted between the two tags.
 *
 * This is specially useful for macros like BI, BR, etc.
 *
 * @param {string} tag1
 *
 * @param {string} tag2
 *
 * @param {string} c
 *
 * @returns {string}
 *
 * @alias generateAlternTag
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.generateAlternTag = function (tag1, tag2, c) {
  var i = -1,
    result = '',
    currentTag = tag2;

  c = this.parseArguments(c);

  while(c[++i]) {
    currentTag = currentTag === tag1 ? tag2 : tag1;
    result += this.generateTag(currentTag, c[i]);
  }

  return result;
};

/**
 * Create HTML markup to close a specific tag
 *
 * @argument {string} tag name of the tag
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeTag = function (tag) {
  return '</' + tag + '>';
};

/**
 * Create HTML markup to close a list of tags
 *
 * @argument {array} tags
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeAllTags = function (tags) {
  return this.closeTagsUntil(tags[0], tags);
};

/**
 * Create HTML markup to close a list of tags until a given tag is
 * reached
 *
 * @argument {string} limitTag to be reached, if empty it closes all
 *
 * @argument {array} tags
 *
 * @returns {string}
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.closeTagsUntil = function (limitTag, tags) {
  var result = '',
    tag;

  if(tags.indexOf(limitTag) !== -1) {
    while((tag = tags.pop())) {
      result += this.closeTag(tag);

      if(tag === limitTag) {
        break;
      }
    }
  }

  return result;
};

/**
 * Transform a raw string in an array of arguments, in groff
 * arguments are delimited by spaces and double quotes can
 * be used to specify an argument which contains spaces.
 *
 * @argument {string} args
 *
 * @returns {array}
 *
 * @since 0.0.1
 *Result:  ABCFGHILPRSTUWZabcdfghiklmnopqrstuvwxy1 

 */
HTMLGenerator.prototype.parseArguments = function (args) {
  args = args.match(patterns.arguments) || [];

  return args.map(function (arg) {
    return this.cleanQuotes(arg)
      .trim();
  }.bind(this));
};

/**
 * Useful for macros that require specific behavior inside of a section
 *
 * @argument {string} section name
 *
 * @returns {boolean} wether the value of this.buffer.section is equal to
 * the argument
 *
 * @since 0.0.1
 *
 */
HTMLGenerator.prototype.isInsideOfSection = function (section) {
  return this.buffer.section.toLowerCase() === section.toLowerCase();
};

  return {
    HTMLGenerator: HTMLGenerator,
    Lexer: Lexer,
    Token: Token,
    TokenFactory: TokenFactory,
    macros: macros,
    patterns: patterns,
    Parser: Parser,
    COMMENT: COMMENT,
    MACRO: MACRO,
    IMACRO: IMACRO,
    BREAK: BREAK,
    TEXT: TEXT,
    EMPTY: EMPTY
  };

  }));
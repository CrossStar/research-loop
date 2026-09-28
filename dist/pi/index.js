var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports, module) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = void 0;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
    var REGEX_TEST_TRAILING_SLASH = /\/$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(
      REGEX_REGEXP_RANGE,
      (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
    );
    var negateRange = (range) => range.startsWith("!") || range.startsWith("\\^") ? `^${range.slice(range[0] === "!" ? 1 : 2)}` : range;
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        // Remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\?\s+)$/,
        (_2, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // Replace (\ ) with ' '
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?)\s/g,
        (_2, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^"
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/"
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*(?:\\\*\\\*\\\/)+/,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_2, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_2, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE
      ],
      [
        // > The range notation, e.g. [a-zA-Z],
        // > can be used to match one of the characters in a range.
        // `\` is escaped by step 3
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${negateRange(sanitizeRange(range))}${endEscape}]` : "[]" : "[]"
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        /(?:[^*])$/,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_2, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_2, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var makeRegexPrefix = (pattern) => REPLACERS.reduce(
      (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
      pattern
    );
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);
    var IgnoreRule = class {
      constructor(pattern, mark, body, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = this.regexPrefix.replace(
          REGEX_REPLACE_TRAILING_WILDCARD,
          // It does not need to bind pattern
          TRAILING_WILD_CARD_REPLACERS[mode]
        );
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    };
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body = pattern;
      if (body.indexOf("!") === 0) {
        negative = true;
        body = body.substr(1);
      }
      body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body);
      return new IgnoreRule(
        pattern,
        mark,
        body,
        ignoreCase,
        negative,
        regexPrefix
      );
    };
    var RuleManager = class {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._add, this);
        return this._added;
      }
      // Test one single path without recursively checking parent directories
      //
      // - checkUnignored `boolean` whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // - check `string` either `MODE_IGNORE` or `MODE_CHECK_IGNORE`
      // @returns {TestResult} true if a file is ignored
      test(path, checkUnignored, mode) {
        let ignored = false;
        let unignored = false;
        let matchedRule;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule[mode].test(path);
          if (!matched) {
            return;
          }
          ignored = !negative;
          unignored = negative;
          matchedRule = negative ? UNDEFINED : rule;
        });
        const ret = {
          ignored,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path, originalPath, doThrow) => {
      if (!isString(path)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path) => REGEX_TEST_INVALID_PATH.test(path);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored, slices) {
        const path = originalPath && checkPath.convert(originalPath);
        checkPath(
          path,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path, cache, checkUnignored, slices);
      }
      checkIgnore(path) {
        if (!REGEX_TEST_TRAILING_SLASH.test(path)) {
          return this.test(path);
        }
        const slices = path.split(SLASH).filter(Boolean);
        slices.pop();
        if (slices.length) {
          const parent = this._t(
            slices.join(SLASH) + SLASH,
            this._testCache,
            true,
            slices
          );
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path, false, MODE_CHECK_IGNORE);
      }
      _t(path, cache, checkUnignored, slices) {
        if (path in cache) {
          return cache[path];
        }
        if (!slices) {
          slices = path.split(SLASH).filter(Boolean);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path] = this._rules.test(path, checkUnignored, MODE_IGNORE);
        }
        const parent = this._t(
          slices.join(SLASH) + SLASH,
          cache,
          checkUnignored,
          slices
        );
        return cache[path] = parent.ignored ? parent : this._rules.test(path, checkUnignored, MODE_IGNORE);
      }
      ignores(path) {
        return this._test(path, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path) => !this.ignores(path);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path) {
        return this._test(path, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path) => checkPath(path && checkPath.convert(path), path, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path) || isNotRelative(path);
    };
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && process.platform === "win32"
    ) {
      setupWindows();
    }
    module.exports = factory;
    factory.default = factory;
    module.exports.isPathValid = isPathValid;
    define(module.exports, Symbol.for("setupWindows"), setupWindows);
  }
});

// src/index.ts
import { StringEnum as StringEnum2 } from "@earendil-works/pi-ai";
import { Container as Container2, Key, matchesKey, Text as Text2 } from "@earendil-works/pi-tui";
import { Type as Type2 } from "typebox";

// src/core/artifacts.ts
import { opendir, stat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";
var SUPPORTED_ARTIFACT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".csv",
  ".json",
  ".html",
  ".pdf",
  ".parquet"
]);
var TABLE_EXTENSIONS = /* @__PURE__ */ new Set([".csv", ".parquet"]);
var HARD_IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  ".pi",
  ".claude",
  "node_modules",
  "__pycache__"
]);
function isHardIgnoredArtifactDirectory(name) {
  return HARD_IGNORED_DIRECTORIES.has(name.trim().toLowerCase());
}
function isVirtualEnvironmentDirectoryName(name) {
  return /^\.?venv(?:[-_.].+)?$/.test(name.trim().toLowerCase());
}
function isIgnoredArtifactDirectory(name) {
  return isHardIgnoredArtifactDirectory(name) || isVirtualEnvironmentDirectoryName(name);
}
async function resolveArtifactMetadata(cwd, inputPath) {
  const cleanPath = inputPath.startsWith("@") ? inputPath.slice(1) : inputPath;
  const absolutePath = resolve(cwd, cleanPath);
  try {
    const fileStat = await stat(absolutePath);
    if (fileStat.isDirectory()) return scanDatasetDirectory(cwd, absolutePath, fileStat.mtimeMs);
    if (!fileStat.isFile()) return void 0;
    const extension = extname(absolutePath).toLowerCase();
    if (!SUPPORTED_ARTIFACT_EXTENSIONS.has(extension)) return void 0;
    return {
      kind: "file",
      path: normalizePath(relative(cwd, absolutePath)),
      name: basename(absolutePath),
      extension,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      discoveredAt: Date.now()
    };
  } catch {
    return void 0;
  }
}
async function scanDatasetDirectory(cwd, absoluteDirectory, directoryMtimeMs) {
  const queue = [absoluteDirectory];
  const files = [];
  let entriesSeen = 0;
  let capped = false;
  while (queue.length > 0 && files.length < 200 && entriesSeen < 500) {
    const directory = queue.shift();
    if (!directory) break;
    const handle = await opendir(directory);
    for await (const entry of handle) {
      entriesSeen += 1;
      if (entriesSeen >= 500) {
        capped = true;
        break;
      }
      if (entry.isDirectory()) {
        if (!isIgnoredArtifactDirectory(entry.name)) queue.push(resolve(directory, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = extname(entry.name).toLowerCase();
      if (!TABLE_EXTENSIONS.has(extension)) continue;
      const path = resolve(directory, entry.name);
      const fileStat = await stat(path);
      files.push({ path, extension, size: fileStat.size, mtimeMs: fileStat.mtimeMs });
      if (files.length >= 200) {
        capped = true;
        break;
      }
    }
  }
  if (files.length === 0) return void 0;
  const displayPath = normalizePath(relative(cwd, absoluteDirectory)) || ".";
  return {
    kind: "dataset",
    path: displayPath,
    name: basename(absoluteDirectory),
    extension: files[0]?.extension ?? ".dataset",
    size: files.reduce((total, file) => total + file.size, 0),
    mtimeMs: Math.max(directoryMtimeMs, ...files.map((file) => file.mtimeMs)),
    discoveredAt: Date.now(),
    fileCount: files.length,
    fileCountCapped: capped,
    samplePath: normalizePath(relative(cwd, files[0].path))
  };
}
function normalizePath(path) {
  return path.split(sep).join("/");
}

// src/artifacts.ts
var import_ignore = __toESM(require_ignore(), 1);
import { createReadStream, existsSync, readFileSync, realpathSync, statSync, watch } from "node:fs";
import { open, opendir as opendir2, readFile, realpath, stat as stat2 } from "node:fs/promises";
import { basename as basename2, dirname, extname as extname2, isAbsolute, relative as relative2, resolve as resolve2, sep as sep2 } from "node:path";
import { createInterface } from "node:readline";

// src/table.ts
function formatTable(headers, rows, maxCellWidth = 22) {
  const normalizedHeaders = headers.map((header) => normalizeCell(header, maxCellWidth));
  const normalizedRows = rows.map(
    (row) => headers.map((_2, index) => normalizeCell(row[index] ?? "", maxCellWidth))
  );
  const widths = normalizedHeaders.map(
    (header, index) => Math.max(header.length, ...normalizedRows.map((row) => row[index]?.length ?? 0))
  );
  const renderRow = (row) => widths.map((width, index) => (row[index] ?? "").padEnd(width)).join(" | ").trimEnd();
  const separator = widths.map((width) => "-".repeat(width)).join("-+-");
  return [renderRow(normalizedHeaders), separator, ...normalizedRows.map(renderRow)].join("\n");
}
function normalizeCell(value, maxWidth) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxWidth) return compact;
  return `${compact.slice(0, Math.max(1, maxWidth - 3))}...`;
}

// src/artifacts.ts
var SUPPORTED_EXTENSIONS = SUPPORTED_ARTIFACT_EXTENSIONS;
var TABLE_EXTENSIONS2 = /* @__PURE__ */ new Set([".csv", ".parquet"]);
var MAX_REPORT_JSON_BYTES = 32 * 1024 * 1024;
var IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};
var RESEARCH_LOOP_IGNORE_FILE = ".research-loopignore";
var CONVENTIONAL_ARTIFACT_SUBDIRECTORIES = /* @__PURE__ */ new Set([
  "figures",
  "plots",
  "predictions",
  "activations",
  "checkpoints",
  "logs",
  "tables",
  "shards"
]);
var IGNORED_FILES = /* @__PURE__ */ new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "composer.json",
  "settings.json"
]);
var ArtifactPathPolicy = class {
  project;
  ignoredEnvironmentRoots;
  checkedEnvironmentMarkers = /* @__PURE__ */ new Map();
  ignoreRules;
  constructor(cwd) {
    this.project = resolve2(cwd);
    this.ignoredEnvironmentRoots = [process.env.VIRTUAL_ENV, process.env.CONDA_PREFIX].filter((value) => Boolean(value?.trim())).map((value) => this.projectRelative(value)).filter((value) => Boolean(value));
    try {
      const rules = readFileSync(resolve2(this.project, RESEARCH_LOOP_IGNORE_FILE), "utf8");
      this.ignoreRules = (0, import_ignore.default)().add(rules);
    } catch {
      this.ignoreRules = void 0;
    }
  }
  isIgnored(relativePath, directory = false) {
    const normalized = toPosixRelative(relativePath);
    if (!normalized) return false;
    if (normalized === ".." || normalized.startsWith("../")) return true;
    const parts = normalized.split("/");
    if (parts.some(isHardIgnoredArtifactDirectory)) return true;
    if (this.ignoredEnvironmentRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
      return true;
    }
    if (this.isInsideMarkedPythonEnvironment(parts, directory)) return true;
    if (parts.some(isVirtualEnvironmentDirectoryName)) return true;
    return this.ignoreRules?.ignores(directory ? `${normalized}/` : normalized) ?? false;
  }
  isInsideMarkedPythonEnvironment(parts, directory) {
    const limit = directory ? parts.length : Math.max(0, parts.length - 1);
    for (let length = 1; length <= limit; length += 1) {
      const candidate = parts.slice(0, length).join("/");
      let ignored = this.checkedEnvironmentMarkers.get(candidate);
      if (ignored === void 0) {
        const absolute = resolve2(this.project, candidate);
        ignored = existsSync(resolve2(absolute, "pyvenv.cfg"));
        if (ignored || existsSync(absolute)) this.checkedEnvironmentMarkers.set(candidate, ignored);
      }
      if (ignored) return true;
    }
    return false;
  }
  projectRelative(input) {
    const absolute = resolve2(this.project, input.trim());
    const candidate = relative2(this.project, absolute);
    if (!candidate || candidate === ".." || candidate.startsWith(`..${sep2}`) || isAbsolute(candidate)) {
      return void 0;
    }
    return candidate.split(sep2).join("/");
  }
};
var ArtifactRadar = class {
  constructor(cwd, initialRecords, onArtifact, artifactRoots = []) {
    this.cwd = cwd;
    this.onArtifact = onArtifact;
    this.artifactRoots = artifactRoots;
    this.records = [...initialRecords];
    this.pathPolicy = new ArtifactPathPolicy(cwd);
  }
  watchers = [];
  watcherSignature = "";
  rootRefreshTimer;
  stopped = true;
  captureDepth = 0;
  records;
  pending = /* @__PURE__ */ new Map();
  pendingDatasetEmits = /* @__PURE__ */ new Map();
  pendingNewDatasets = /* @__PURE__ */ new Set();
  datasetMembers = /* @__PURE__ */ new Map();
  pathPolicy;
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    try {
      const hasMissingRoots = this.refreshWatchers();
      if (hasMissingRoots) {
        this.rootRefreshTimer = setInterval(() => {
          try {
            if (!this.refreshWatchers() && this.rootRefreshTimer) {
              clearInterval(this.rootRefreshTimer);
              this.rootRefreshTimer = void 0;
            }
          } catch {
            this.stop();
          }
        }, 250);
        this.rootRefreshTimer.unref();
      }
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop() {
    this.stopped = true;
    if (this.rootRefreshTimer) clearInterval(this.rootRefreshTimer);
    this.rootRefreshTimer = void 0;
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
    this.watcherSignature = "";
    for (const timer of [...this.pending.values(), ...this.pendingDatasetEmits.values()]) clearTimeout(timer);
    this.pending.clear();
    this.pendingDatasetEmits.clear();
    this.pendingNewDatasets.clear();
  }
  refreshWatchers() {
    if (this.stopped) return false;
    const targets = resolveArtifactWatchTargets(this.cwd, this.artifactRoots, this.pathPolicy);
    const signature = JSON.stringify(targets);
    if (signature === this.watcherSignature) return targets.length < this.artifactRoots.length;
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
    this.watcherSignature = signature;
    for (const target of targets) {
      const watcher = watch(target.path, { recursive: target.recursive }, (_event, filename) => {
        if (this.captureDepth === 0 || !filename) return;
        const relativePath = relative2(this.cwd, resolve2(target.eventBase, filename.toString())).split(sep2).join("/");
        if (!isWithinRoots(relativePath, this.artifactRoots) || !isCandidate(relativePath, this.pathPolicy)) return;
        this.queue(relativePath);
      });
      watcher.on("error", () => this.stop());
      this.watchers.push(watcher);
    }
    return targets.length < this.artifactRoots.length;
  }
  beginCapture() {
    this.captureDepth += 1;
  }
  endCapture() {
    setTimeout(() => {
      this.captureDepth = Math.max(0, this.captureDepth - 1);
    }, 600);
  }
  getArtifacts() {
    return [...this.records].sort((a, b2) => a.discoveredAt - b2.discoveredAt);
  }
  queue(relativePath) {
    const existing = this.pending.get(relativePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(relativePath);
      void this.inspect(relativePath).catch(() => void 0);
    }, 120);
    this.pending.set(relativePath, timer);
  }
  async inspect(relativePath) {
    const absolutePath = resolve2(this.cwd, relativePath);
    let fileStat;
    try {
      fileStat = await stat2(absolutePath);
    } catch {
      return;
    }
    if (!fileStat.isFile()) return;
    const normalizedPath = relative2(this.cwd, absolutePath).split(sep2).join("/");
    const extension = extname2(normalizedPath).toLowerCase();
    if (isDatasetShard(normalizedPath, extension)) {
      this.upsertDatasetShard(normalizedPath, extension, fileStat.size, fileStat.mtimeMs);
      return;
    }
    const previous = this.records.find((record2) => record2.kind === "file" && record2.path === normalizedPath);
    if (previous && previous.mtimeMs === fileStat.mtimeMs && previous.size === fileStat.size) return;
    const record = {
      kind: "file",
      path: normalizedPath,
      name: basename2(normalizedPath),
      extension,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      discoveredAt: Date.now()
    };
    if (this.stopped) return;
    if (previous) {
      this.records[this.records.indexOf(previous)] = record;
    } else {
      this.records.push(record);
    }
    this.onArtifact(record, previous === void 0);
  }
  upsertDatasetShard(path, extension, size, mtimeMs) {
    if (this.stopped) return;
    const datasetPath = dirname(path).split(sep2).join("/");
    const members = this.datasetMembers.get(datasetPath) ?? /* @__PURE__ */ new Map();
    const previousMember = members.get(path);
    if (previousMember?.size === size && previousMember.mtimeMs === mtimeMs) return;
    members.set(path, { size, mtimeMs });
    this.datasetMembers.set(datasetPath, members);
    const previous = this.records.find((record2) => record2.kind === "dataset" && record2.path === datasetPath);
    const isNew = previous === void 0;
    const sizeDelta = size - (previousMember?.size ?? 0);
    const record = {
      kind: "dataset",
      path: datasetPath,
      name: basename2(datasetPath),
      extension,
      size: Math.max(0, (previous?.size ?? 0) + sizeDelta),
      mtimeMs: Math.max(previous?.mtimeMs ?? 0, mtimeMs),
      discoveredAt: Date.now(),
      fileCount: (previous?.fileCount ?? 0) + (previousMember ? 0 : 1),
      samplePath: previous?.samplePath ?? path
    };
    if (previous) this.records[this.records.indexOf(previous)] = record;
    else {
      this.records.push(record);
      this.pendingNewDatasets.add(datasetPath);
    }
    const pending = this.pendingDatasetEmits.get(datasetPath);
    if (pending) clearTimeout(pending);
    this.pendingDatasetEmits.set(
      datasetPath,
      setTimeout(() => {
        this.pendingDatasetEmits.delete(datasetPath);
        const firstNotification = this.pendingNewDatasets.delete(datasetPath);
        if (!this.stopped) this.onArtifact(record, firstNotification || isNew);
      }, 300)
    );
  }
};
async function resolveArtifactRecord(cwd, inputPath) {
  return resolveArtifactMetadata(cwd, inputPath);
}
function createArtifactRootNormalizer(cwd) {
  const pathPolicy = new ArtifactPathPolicy(cwd);
  return (inputs) => normalizeArtifactRootsWithPolicy(cwd, inputs, pathPolicy);
}
function normalizeArtifactRoots(cwd, inputs) {
  return createArtifactRootNormalizer(cwd)(inputs);
}
function normalizeArtifactRootsWithPolicy(cwd, inputs, pathPolicy) {
  const project = resolve2(cwd);
  const projectReal = realpathSync(project);
  const normalized = [];
  for (const input of inputs) {
    if (typeof input !== "string" || !input.trim()) continue;
    const absolute = resolve2(project, input.trim());
    const projectRelative = relative2(project, absolute);
    if (!projectRelative || projectRelative === "." || projectRelative === ".." || projectRelative.startsWith(`..${sep2}`) || isAbsolute(projectRelative)) continue;
    const exists = existsSync(absolute);
    let directory = true;
    try {
      if (exists) directory = statSync(absolute).isDirectory();
    } catch {
      continue;
    }
    if (pathPolicy.isIgnored(projectRelative, directory)) continue;
    if (exists) {
      try {
        const resolvedTarget = realpathSync(absolute);
        const realRelative = relative2(projectReal, resolvedTarget);
        if (realRelative === ".." || realRelative.startsWith(`..${sep2}`) || isAbsolute(realRelative)) continue;
      } catch {
        continue;
      }
    }
    normalized.push(projectRelative.split(sep2).join("/"));
  }
  return compactRoots(normalized);
}
function inferArtifactRoot(record) {
  if (record.kind === "dataset") return stripConventionalLeaf(record.path);
  const directory = dirname(record.path).split(sep2).join("/");
  return directory === "." ? record.path : stripConventionalLeaf(directory);
}
async function discoverArtifactsFromRoots(cwd, inputs, signal) {
  signal?.throwIfAborted();
  const pathPolicy = new ArtifactPathPolicy(cwd);
  const roots = normalizeArtifactRootsWithPolicy(cwd, inputs, pathPolicy);
  const projectReal = await realpath(cwd);
  const files = /* @__PURE__ */ new Map();
  const datasets = /* @__PURE__ */ new Map();
  const inspectFile = async (absolutePath) => {
    signal?.throwIfAborted();
    const normalizedPath = relative2(projectReal, absolutePath).split(sep2).join("/");
    if (!isCandidate(normalizedPath, pathPolicy)) return;
    const fileStat = await stat2(absolutePath);
    if (!fileStat.isFile()) return;
    const extension = extname2(normalizedPath).toLowerCase();
    if (isDatasetShard(normalizedPath, extension)) {
      const datasetPath = dirname(normalizedPath).split(sep2).join("/");
      const previous = datasets.get(datasetPath);
      datasets.set(datasetPath, {
        extension,
        size: (previous?.size ?? 0) + fileStat.size,
        mtimeMs: Math.max(previous?.mtimeMs ?? 0, fileStat.mtimeMs),
        fileCount: (previous?.fileCount ?? 0) + 1,
        samplePath: previous?.samplePath ?? normalizedPath
      });
      return;
    }
    files.set(`file:${normalizedPath}`, {
      kind: "file",
      path: normalizedPath,
      name: basename2(normalizedPath),
      extension,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      discoveredAt: Date.now()
    });
  };
  for (const root of roots) {
    signal?.throwIfAborted();
    const absoluteRoot = resolve2(cwd, root);
    let rootStat;
    try {
      const resolvedRoot = await realpath(absoluteRoot);
      const realRelative = relative2(projectReal, resolvedRoot);
      if (realRelative === ".." || realRelative.startsWith(`..${sep2}`) || isAbsolute(realRelative)) continue;
      rootStat = await stat2(resolvedRoot);
      if (rootStat.isFile()) {
        await inspectFile(resolvedRoot);
        continue;
      }
      if (!rootStat.isDirectory()) continue;
      const queue = [resolvedRoot];
      while (queue.length > 0) {
        signal?.throwIfAborted();
        const directory = queue.shift();
        if (!directory) break;
        const handle = await opendir2(directory);
        for await (const entry of handle) {
          signal?.throwIfAborted();
          const absoluteEntry = resolve2(directory, entry.name);
          if (entry.isDirectory()) {
            const relativeEntry = relative2(projectReal, absoluteEntry).split(sep2).join("/");
            if (!pathPolicy.isIgnored(relativeEntry, true)) queue.push(absoluteEntry);
          } else if (entry.isFile()) await inspectFile(absoluteEntry);
        }
      }
    } catch (error) {
      if (signal?.aborted) signal.throwIfAborted();
      if (error instanceof Error && error.name === "AbortError") throw error;
      continue;
    }
  }
  for (const [path, dataset] of datasets) {
    files.set(`dataset:${path}`, {
      kind: "dataset",
      path,
      name: basename2(path),
      extension: dataset.extension,
      size: dataset.size,
      mtimeMs: dataset.mtimeMs,
      discoveredAt: Date.now(),
      fileCount: dataset.fileCount,
      samplePath: dataset.samplePath
    });
  }
  return [...files.values()].sort((a, b2) => a.path.localeCompare(b2.path));
}
async function loadArtifactPreview(pi, cwd, record, selectedColumns) {
  const targetPath = record.kind === "dataset" ? record.samplePath : record.path;
  if (!targetPath) return { title: record.name, text: datasetMetadata(record) };
  const absolutePath = resolve2(cwd, targetPath);
  const metadata = record.kind === "dataset" ? `${datasetMetadata(record)}
Sample shard: ${targetPath}` : `${record.path}
${formatSize(record.size)} | ${record.extension.slice(1).toUpperCase()}`;
  const mimeType2 = IMAGE_MIME[record.extension];
  if (mimeType2 && record.kind === "file") {
    return {
      title: record.name,
      text: metadata,
      image: { data: (await readFile(absolutePath)).toString("base64"), mimeType: mimeType2 }
    };
  }
  if (record.extension === ".csv") {
    return { title: record.name, text: `${metadata}

${await previewCsv(absolutePath, selectedColumns)}` };
  }
  if (record.extension === ".json" && record.kind === "file") {
    return { title: record.name, text: `${metadata}

${await previewJson(absolutePath, record.size)}` };
  }
  if (record.extension === ".svg" && record.kind === "file") {
    const content = await readFile(absolutePath, "utf8");
    return { title: record.name, text: `${metadata}

${truncate(content, 4e3)}` };
  }
  if (record.extension === ".parquet") {
    const parquet = await previewParquet(
      pi,
      absolutePath,
      selectedColumns,
      record.kind === "dataset"
    );
    return {
      title: record.name,
      text: `${metadata}

${parquet ?? "Parquet preview requires a local pyarrow installation."}`
    };
  }
  return { title: record.name, text: metadata };
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function toPosixRelative(path) {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+|\/+$/g, "");
}
function compactRoots(roots) {
  const ordered = [...new Set(roots)].sort((a, b2) => a.length - b2.length || a.localeCompare(b2));
  const compacted = [];
  for (const root of ordered) {
    if (compacted.some((parent) => parent === "." || root === parent || root.startsWith(`${parent}/`))) continue;
    compacted.push(root);
  }
  return compacted;
}
function stripConventionalLeaf(path) {
  const normalized = path.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (/^(?:run|experiment|exp)[-_.].+/i.test(parts[index])) {
      return parts.slice(0, index + 1).join("/");
    }
  }
  if (parts.length > 1 && CONVENTIONAL_ARTIFACT_SUBDIRECTORIES.has(parts.at(-1).toLowerCase())) {
    return parts.slice(0, -1).join("/");
  }
  return normalized;
}
function isWithinRoots(path, roots) {
  if (roots.length === 0) return false;
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}
function resolveArtifactWatchTargets(cwd, roots, pathPolicy = new ArtifactPathPolicy(cwd)) {
  const normalizedRoots = normalizeArtifactRootsWithPolicy(cwd, roots, pathPolicy);
  if (normalizedRoots.length === 0) return [];
  const projectReal = realpathSync(cwd);
  const targets = /* @__PURE__ */ new Map();
  for (const root of normalizedRoots) {
    const candidate = resolve2(cwd, root);
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isFile()) {
      const file = realpathSync(candidate);
      targets.set(`file:${file}`, { path: file, eventBase: dirname(file), recursive: false });
      continue;
    }
    const resolvedTarget = realpathSync(candidate);
    const projectRelative = relative2(projectReal, resolvedTarget);
    const directory = projectRelative === ".." || projectRelative.startsWith(`..${sep2}`) || isAbsolute(projectRelative) ? projectReal : resolvedTarget;
    targets.set(`directory:${directory}`, { path: directory, eventBase: directory, recursive: true });
  }
  return [...targets.values()];
}
function isCandidate(relativePath, pathPolicy) {
  const normalized = relativePath.split(/[\\/]+/);
  if (pathPolicy.isIgnored(relativePath, false)) return false;
  const name = normalized.at(-1)?.toLowerCase() ?? "";
  if (IGNORED_FILES.has(name) || name.startsWith("tsconfig.")) return false;
  return SUPPORTED_EXTENSIONS.has(extname2(name).toLowerCase());
}
function isDatasetShard(path, extension) {
  if (!TABLE_EXTENSIONS2.has(extension)) return false;
  const name = basename2(path);
  return /(?:^|[-_.])(?:part|shard|chunk|batch)[-_.]?\d+/i.test(name) || /-\d{3,}-of-\d{3,}\./i.test(name) || /^\d{3,}\.(?:csv|parquet)$/i.test(name);
}
function datasetMetadata(record) {
  const count2 = `${record.fileCountCapped ? ">=" : ""}${record.fileCount ?? 0}`;
  return `${record.path}
Dataset | ${count2} ${record.extension.slice(1).toUpperCase()} files | ${formatSize(record.size)} sampled`;
}
async function previewCsv(path, selectedColumns) {
  const input = createReadStream(path);
  const lines = createInterface({ input, crlfDelay: Infinity });
  const sample = [];
  const maxLines = 1e4;
  let lineCount = 0;
  let capped = false;
  for await (const line of lines) {
    lineCount += 1;
    if (sample.length < 6) sample.push(line);
    if (lineCount >= maxLines) {
      capped = true;
      break;
    }
  }
  if (capped) input.destroy();
  const parsed = sample.map(parseCsvLine);
  const header = parsed[0] ?? [];
  const requestedIndexes = (selectedColumns ?? []).map((column) => header.indexOf(column)).filter((index) => index >= 0);
  const indexes = (requestedIndexes.length > 0 ? requestedIndexes : header.map((_2, index) => index)).slice(0, 6);
  const rows = Math.max(0, lineCount - (lineCount > 0 ? 1 : 0));
  const rowLabel = capped ? `>=${rows}` : String(rows);
  const table = formatTable(
    indexes.map((index) => header[index] ?? ""),
    parsed.slice(1).map((fields) => indexes.map((index) => fields[index] ?? "")),
    16
  );
  const selection = requestedIndexes.length > 0 ? `; selected columns: ${indexes.map((index) => header[index]).join(", ")}` : header.length > indexes.length ? `; showing first ${indexes.length} columns` : "";
  return `Shape: ${rowLabel} rows x ${header.length} columns${capped ? " (quick scan)" : ""}${selection}

${table}`;
}
async function previewJson(path, size) {
  if (size > 2 * 1024 * 1024) {
    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(4e3);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return `Large JSON; showing the beginning only.

${buffer.toString("utf8", 0, bytesRead)}
...`;
    } finally {
      await handle.close();
    }
  }
  const value = JSON.parse(await readFile(path, "utf8"));
  let structure;
  if (Array.isArray(value)) structure = `Top level: array (${value.length} items)`;
  else if (value && typeof value === "object") {
    structure = `Top-level keys: ${Object.keys(value).slice(0, 20).join(", ") || "(none)"}`;
  } else structure = `Top level: ${typeof value}`;
  return `${structure}

${truncate(JSON.stringify(value, null, 2), 4e3)}`;
}
function parseCsvLine(line) {
  if (line.length === 0) return [];
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += char;
  }
  fields.push(field);
  return fields;
}
var PARQUET_PREVIEW_SCRIPT = `import json, sys
import pyarrow.parquet as pq
parquet = pq.ParquetFile(sys.argv[1])
all_columns = parquet.schema_arrow.names
requested = json.loads(sys.argv[2])
columns = [column for column in requested if column in all_columns][:6] or all_columns[:6]
rows = []
if parquet.num_row_groups:
    rows = parquet.read_row_group(0, columns=columns).slice(0, 5).to_pylist()
print(json.dumps({
    "rowCount": parquet.metadata.num_rows,
    "columnCount": len(all_columns),
    "columns": columns,
    "rows": rows,
}, default=str))`;
async function previewParquet(pi, absolutePath, selectedColumns, sampleShard = false) {
  const python = process.platform === "win32" ? "python" : "python3";
  const result = await pi.exec(
    python,
    ["-c", PARQUET_PREVIEW_SCRIPT, absolutePath, JSON.stringify(selectedColumns ?? [])],
    { timeout: 5e3 }
  );
  if (result.code !== 0) return void 0;
  const data = JSON.parse(result.stdout);
  const table = formatTable(
    data.columns,
    data.rows.map((row) => data.columns.map((column) => formatPreviewCell(row[column]))),
    16
  );
  const columnLabel = selectedColumns?.length ? `; selected columns: ${data.columns.join(", ")}` : data.columnCount > data.columns.length ? `; showing first ${data.columns.length} columns` : "";
  const shapeLabel = sampleShard ? "Sample shard shape" : "Shape";
  return `${shapeLabel}: ${data.rowCount} rows x ${data.columnCount} columns${columnLabel}

${table}`;
}
function formatPreviewCell(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= 16 ? compact : `${compact.slice(0, 15)}...`;
}
function truncate(value, limit) {
  return value.length <= limit ? value : `${value.slice(0, limit)}
...`;
}

// src/checkpoint.ts
import { StringEnum } from "@earendil-works/pi-ai";
import { Container, Text } from "@earendil-works/pi-tui";
import { readFileSync as readFileSync2 } from "node:fs";
import { realpath as realpath4, stat as stat5 } from "node:fs/promises";
import { basename as basename4, extname as extname5, relative as relative5, resolve as resolve6, sep as sep5 } from "node:path";
import { Type } from "typebox";

// src/checkpoint-server.ts
import { createReadStream as createReadStream2 } from "node:fs";
import { open as open2, readFile as readFile4, realpath as realpath3, stat as stat4 } from "node:fs/promises";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { extname as extname4, relative as relative4, resolve as resolve5, sep as sep4 } from "node:path";
import { fileURLToPath } from "node:url";

// node_modules/marked/lib/marked.esm.js
function C() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var R = C();
function j(l3) {
  R = l3;
}
var z = { exec: () => null };
function A(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = l3(n), e[n] = s), s;
  };
}
function d(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let i = typeof r == "string" ? r : r.source;
    return i = i.replace(m.caret, "$1"), t = t.replace(s, i), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var Te = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: A((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: A((l3) => new RegExp(`^ {0,${l3}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: A((l3) => new RegExp(`^ {0,${l3}}>`)) };
var Oe = /^(?:[ \t]*(?:\n|$))+/;
var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var q = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var U = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var ae = d(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Se = d(oe).replace(/bull/g, U).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var K = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
var _e = /^[^\n]+/;
var W = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var $e = d(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", W).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var Le = d(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, U).getRegex();
var Q = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var X = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var Me = d("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", X).replace("tag", Q).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var le = (l3) => d(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", l3).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
var ze = le(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
var Ee = le(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
var Ce = d(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", Ee).getRegex();
var J = { blockquote: Ce, code: we, def: $e, fences: ye, heading: Pe, hr: q, html: Me, lheading: ae, list: Le, newline: Oe, paragraph: ze, table: z, text: _e };
var se = d("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex();
var Ae = { ...J, lheading: Se, table: se, paragraph: d(K).replace("hr", q).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", Q).getRegex() };
var Ie = { ...J, html: d(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", X).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: z, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d(K).replace("hr", q).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Be = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var De = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var pe = /^( {2,}|\\)\n(?!\s*$)/;
var qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _ = /[\p{P}\p{S}]/u;
var I = /[\s\p{P}\p{S}]/u;
var v = /[^\s\p{P}\p{S}]/u;
var ve = d(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, I).getRegex();
var He = /[\p{Pi}\p{Ps}"']/u;
var ue = /(?!~)[\p{P}\p{S}]/u;
var Ze = /(?!~)[\s\p{P}\p{S}]/u;
var Ge = /(?:[^\s\p{P}\p{S}]|~)/u;
var Qe = d(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Ne = d(ce, "u").replace(/punct/g, _).getRegex();
var je = d(ce, "u").replace(/punct/g, ue).getRegex();
var Fe = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;
var Ue = d(Fe, "u").replace(/openQuote/g, He).replace(/punct/g, _).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ke = d(he, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var We = d(he, "gu").replace(/notPunctSpace/g, Ge).replace(/punctSpace/g, Ze).replace(/punct/g, ue).getRegex();
var Xe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)";
var Je = d(Xe, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var Ve = d("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var Ye = "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)";
var et = d(Ye, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var tt = d(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, _).getRegex();
var nt = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var rt = d(nt, "gu").replace(/notPunctSpace/g, v).replace(/punctSpace/g, I).replace(/punct/g, _).getRegex();
var st = d(/\\(punct)/, "gu").replace(/punct/g, _).getRegex();
var it = d(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var ot = d(X).replace("(?:-->|$)", "-->").getRegex();
var at = d("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ot).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var G = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var lt = d(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", G).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var de = d(/^!?\[(label)\]\[(ref)\]/).replace("label", G).replace("ref", W).getRegex();
var ke = d(/^!?\[(ref)\](?:\[\])?/).replace("ref", W).getRegex();
var pt = d("reflink|nolink(?!\\()", "g").replace("reflink", de).replace("nolink", ke).getRegex();
var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var V = { _backpedal: z, anyPunctuation: st, autolink: it, blockSkip: Qe, br: pe, code: De, del: z, delLDelim: z, delRDelim: z, emStrongLDelim: Ne, emStrongRDelimAst: Ke, emStrongRDelimUnd: Ve, escape: Be, link: lt, nolink: ke, punctuation: ve, reflink: de, reflinkSearch: pt, tag: at, text: qe, url: z };
var ut = { ...V, emStrongLDelim: Ue, emStrongRDelimAst: Je, emStrongRDelimUnd: et, link: d(/^!?\[(label)\]\((.*?)\)/).replace("label", G).getRegex(), reflink: d(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", G).getRegex() };
var F = { ...V, emStrongRDelimAst: We, emStrongLDelim: je, delLDelim: tt, delRDelim: rt, url: d(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d(/^(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() };
var ct = { ...F, br: d(pe).replace("{2,}", "*").getRegex(), text: d(F.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var H = { normal: J, gfm: Ae, pedantic: Ie };
var B = { normal: V, gfm: F, breaks: ct, pedantic: ut };
var ht = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l3) => ht[l3];
function O(l3, e) {
  if (e) {
    if (m.escapeTest.test(l3)) return l3.replace(m.escapeReplace, ge);
  } else if (m.escapeTestNoEncode.test(l3)) return l3.replace(m.escapeReplaceNoEncode, ge);
  return l3;
}
function Y(l3) {
  try {
    l3 = encodeURI(l3).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function ee(l3, e) {
  let t = l3.replace(m.findPipe, (r, i, o) => {
    let p = false, a = i;
    for (; --a >= 0 && o[a] === "\\"; ) p = !p;
    return p ? "|" : " |";
  }), n = t.split(m.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(m.slashPipe, "|");
  return n;
}
function $(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function te(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && m.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function fe(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function me(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function xe(l3, e, t, n, s) {
  let r = e.href, i = e.title || null, o = l3[1].replace(s.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let p = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: r, title: i, text: o, tokens: n.inlineTokens(o) };
  return n.state.inLink = false, p;
}
function dt(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let i = r.match(t.other.beginningSpace);
    if (i === null) return r;
    let [o] = i;
    return o.length >= s.length ? r.slice(s.length) : r;
  }).join(`
`);
}
var y = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || R;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : te(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = dt(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = $(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: $(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: $(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = $(t[0], `
`).split(`
`), s = "", r = "", i = [];
      for (; n.length > 0; ) {
        let o = false, p = [], a;
        for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) p.push(n[a]), o = true;
        else if (!o) p.push(n[a]);
        else break;
        n = n.slice(a);
        let u = p.join(`
`), c = u.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${u}` : u, r = r ? `${r}
${c}` : c;
        let h = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(c, i, true), this.lexer.state.top = h, n.length === 0) break;
        let k = i.at(-1);
        if (k?.type === "code") break;
        if (k?.type === "blockquote") {
          let T = k, g = n.join(`
`), w = T.raw + `
` + g.replace(this.rules.other.blockquoteSetextReplace2, ""), M = this.blockquote(w);
          i[i.length - 1] = M, s = `${s}
${g}`, r = r.substring(0, r.length - T.text.length) + M.text;
          break;
        } else if (k?.type === "list") {
          let T = k, g = T.raw + `
` + n.join(`
`), w = this.list(g);
          i[i.length - 1] = w, s = s.substring(0, s.length - k.raw.length) + w.raw, r = r.substring(0, r.length - T.raw.length) + w.raw, n = g.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: i, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let i = this.rules.other.listItemRegex(n), o = false;
      for (; e; ) {
        let a = false, u = "", c = "";
        if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
        u = t[0], e = e.substring(u.length);
        let h = me(t[2].split(`
`, 1)[0], t[1].length), k = e.split(`
`, 1)[0], T = !h.trim(), g = 0;
        if (this.options.pedantic ? (g = 2, c = h.trimStart()) : T ? g = t[1].length + 1 : (g = h.search(this.rules.other.nonSpaceChar), g = g > 4 ? 1 : g, c = h.slice(g), g += t[1].length), T && this.rules.other.blankLine.test(k) && (u += k + `
`, e = e.substring(k.length + 1), a = true), !a) {
          let w = this.rules.other.nextBulletRegex(g), M = this.rules.other.hrRegex(g), ne = this.rules.other.fencesBeginRegex(g), re = this.rules.other.headingBeginRegex(g), be = this.rules.other.htmlBeginRegex(g), Re = this.rules.other.blockquoteBeginRegex(g);
          for (; e; ) {
            let N = e.split(`
`, 1)[0], D;
            if (k = N, this.options.pedantic ? (k = k.replace(this.rules.other.listReplaceNesting, "  "), D = k) : D = k.replace(this.rules.other.tabCharGlobal, "    "), ne.test(k) || re.test(k) || be.test(k) || Re.test(k) || w.test(k) || M.test(k)) break;
            if (D.search(this.rules.other.nonSpaceChar) >= g || !k.trim()) c += `
` + D.slice(g);
            else {
              if (T || h.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(h) || re.test(h) || M.test(h)) break;
              c += `
` + k;
            }
            T = !k.trim(), u += N + `
`, e = e.substring(N.length + 1), h = D.slice(g);
          }
        }
        r.loose || (o ? r.loose = true : this.rules.other.doubleBlankLine.test(u) && (o = true)), r.items.push({ type: "list_item", raw: u, task: !!this.options.gfm && this.rules.other.listIsTask.test(c), loose: false, text: c, tokens: [] }), r.raw += u;
      }
      let p = r.items.at(-1);
      if (p) p.raw = p.raw.trimEnd(), p.text = p.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a of r.items) if (this.lexer.state.top = false, a.tokens = this.lexer.blockTokens(a.text, []), !r.loose) {
        let u = a.tokens.filter((h) => h.type === "space"), c = u.length > 0 && u.some((h) => this.rules.other.anyLine.test(h.raw));
        r.loose = c;
      }
      for (let a of r.items) {
        let u = a.tokens[0];
        if (a.task && (u?.type === "text" || u?.type === "paragraph")) {
          a.text = a.text.replace(this.rules.other.listReplaceTask, ""), u.raw = u.raw.replace(this.rules.other.listReplaceTask, ""), u.text = u.text.replace(this.rules.other.listReplaceTask, "");
          for (let h = this.lexer.inlineQueue.length - 1; h >= 0; h--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[h].src)) {
            this.lexer.inlineQueue[h].src = this.lexer.inlineQueue[h].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let c = this.rules.other.listTaskCheckbox.exec(a.raw);
          if (c) {
            let h = { type: "checkbox", raw: c[0] + " ", checked: c[0] !== "[ ]" };
            a.checked = h.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = h.raw + a.tokens[0].raw, a.tokens[0].text = h.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(h)) : a.tokens.unshift({ type: "paragraph", raw: h.raw, text: h.raw, tokens: [h] }) : a.tokens.unshift(h);
          }
        } else a.task && (a.task = false);
      }
      if (r.loose) for (let a of r.items) {
        a.loose = true;
        for (let u of a.tokens) u.type === "text" && (u.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = te(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: $(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = ee(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: $(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < n.length; o++) i.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: true, align: i.align[o] });
      for (let o of r) i.rows.push(ee(o, i.header.length).map((p, a) => ({ text: p, tokens: this.lexer.inline(p), header: false, align: i.align[a] })));
      return i;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: $(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let i = $(n.slice(0, -1), "\\");
        if ((n.length - i.length) % 2 === 0) return;
      } else {
        let i = fe(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let p = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, p).trim(), t[3] = "";
        }
      }
      let s = t[2], r = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(s);
        i && (s = i[1], r = i[3]);
      } else r = t[3] ? t[3].slice(1, -1) : "";
      return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), xe(t, { href: s && s.replace(this.rules.inline.anyPunctuation, "$1"), title: r && r.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r = t[s.toLowerCase()];
      if (!r) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return xe(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, p, a = i, u = 0, c = s[0][0], h = n === c, k = c === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (k.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = k.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
        if (p = [...o].length, s[3] || s[4]) {
          a += p;
          continue;
        } else if (s[5] || s[6]) {
          if (i % 3 && !((i + p) % 3)) {
            u += p;
            continue;
          }
          if (h) break;
        }
        if (a -= p, a > 0) continue;
        p = Math.min(p, p + a + u);
        let T = [...s[0]][0].length, g = e.slice(0, i + s.index + T + p);
        if (Math.min(i, p) % 2) {
          let M = g.slice(1, -1);
          return { type: "em", raw: g, text: M, tokens: this.lexer.inlineTokens(M) };
        }
        let w = g.slice(2, -2);
        return { type: "strong", raw: g, text: w, tokens: this.lexer.inlineTokens(w) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, p, a = i, u = this.rules.inline.delRDelim;
      for (u.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = u.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (p = [...o].length, p !== i)) continue;
        if (s[3] || s[4]) {
          a += p;
          continue;
        }
        if (a -= p, a > 0) continue;
        p = Math.min(p, p + a);
        let c = [...s[0]][0].length, h = e.slice(0, i + s.index + c + p), k = h.slice(i, -i);
        return { type: "del", raw: h, text: k, tokens: this.lexer.inlineTokens(k) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || R, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: H.normal, inline: B.normal };
    this.options.pedantic ? (t.block = H.pedantic, t.inline = B.pedantic) : this.options.gfm && (t.block = H.gfm, this.options.breaks ? t.inline = B.breaks : t.inline = B.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: H, inline: B };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, p = e.slice(1), a;
        this.options.extensions.startBlock.forEach((u) => {
          a = u.call({ lexer: this }, p), typeof a == "number" && a >= 0 && (o = Math.min(o, a));
        }), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let o = t.at(-1);
        n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = e;
    if (this.tokens.links) {
      let o = Object.keys(this.tokens.links);
      o.length > 0 && (n = n.replace(this.tokenizer.rules.inline.reflinkSearch, (p) => o.includes(p.slice(p.lastIndexOf("[") + 1, -1)) ? "[" + "a".repeat(p.length - 2) + "]" : p));
    }
    n = n.replace(this.tokenizer.rules.inline.anyPunctuation, (o) => "+".repeat(o.length)), n = n.replace(this.tokenizer.rules.inline.blockSkip, (o, p, a) => {
      let u = a ? a.length : 0;
      return o.slice(0, u) + "[" + "a".repeat(o.length - u - 2) + "]";
    }), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let s = false, r = "", i = 1 / 0;
    for (; e; ) {
      if (e.length < i) i = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      s || (r = ""), s = false;
      let o;
      if (this.options.extensions?.inline?.some((a) => (o = a.call({ lexer: this }, e, t)) ? (e = e.substring(o.raw.length), t.push(o), true) : false)) continue;
      if (o = this.tokenizer.escape(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.tag(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.link(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(o.raw.length);
        let a = t.at(-1);
        o.type === "text" && a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (o = this.tokenizer.emStrong(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.codespan(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.br(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.del(e, n, r)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (o = this.tokenizer.autolink(e)) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      if (!this.state.inLink && (o = this.tokenizer.url(e))) {
        e = e.substring(o.raw.length), t.push(o);
        continue;
      }
      let p = e;
      if (this.options.extensions?.startInline) {
        let a = 1 / 0, u = e.slice(1), c;
        this.options.extensions.startInline.forEach((h) => {
          c = h.call({ lexer: this }, u), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
        }), a < 1 / 0 && a >= 0 && (p = e.substring(0, a + 1));
      }
      if (o = this.tokenizer.inlineText(p)) {
        e = e.substring(o.raw.length), o.raw.slice(-1) !== "_" && (r = o.raw.slice(-1)), s = true;
        let a = t.at(-1);
        a?.type === "text" ? (a.raw += o.raw, a.text += o.text) : t.push(o);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var P = class {
  options;
  parser;
  constructor(e) {
    this.options = e || R;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let s = (t || "").match(m.notSpaceStart)?.[0], r = e.replace(m.endingNewline, "") + `
`;
    return s ? '<pre><code class="language-' + O(s) + '">' + (n ? r : O(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, s = "";
    for (let o = 0; o < e.items.length; o++) {
      let p = e.items[o];
      s += this.listitem(p);
    }
    let r = t ? "ol" : "ul", i = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + i + `>
` + s + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let i = e.rows[r];
      n = "";
      for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${O(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let s = this.parser.parseInline(n), r = Y(e);
    if (r === null) return s;
    e = r;
    let i = '<a href="' + e + '"';
    return t && (i += ' title="' + O(t) + '"'), i += ">" + s + "</a>", i;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = Y(e);
    if (r === null) return O(n);
    e = r;
    let i = `<img src="${e}" alt="${O(n)}"`;
    return t && (i += ` title="${O(t)}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
  }
};
var L = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class l2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || R, this.options.renderer = this.options.renderer || new P(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if (this.options.extensions?.renderers?.[s.type]) {
        let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "checkbox", "html", "def", "paragraph", "text"].includes(i.type)) {
          t += o || "";
          continue;
        }
      }
      let r = s;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let i = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== false || !["escape", "html", "link", "image", "checkbox", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "escape": {
          n += t.text(i);
          break;
        }
        case "html": {
          n += t.html(i);
          break;
        }
        case "link": {
          n += t.link(i);
          break;
        }
        case "image": {
          n += t.image(i);
          break;
        }
        case "checkbox": {
          n += t.checkbox(i);
          break;
        }
        case "strong": {
          n += t.strong(i);
          break;
        }
        case "em": {
          n += t.em(i);
          break;
        }
        case "codespan": {
          n += t.codespan(i);
          break;
        }
        case "br": {
          n += t.br(i);
          break;
        }
        case "del": {
          n += t.del(i);
          break;
        }
        case "text": {
          n += t.text(i);
          break;
        }
        default: {
          let o = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
};
var S = class {
  options;
  block;
  constructor(e) {
    this.options = e || R;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? x.lex : x.lexInline;
  }
  provideParser(e = this.block) {
    return e ? b.parse : b.parseInline;
  }
};
var Z = class {
  defaults = C();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b;
  Renderer = P;
  TextRenderer = L;
  Lexer = x;
  Tokenizer = y;
  Hooks = S;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
        for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
          let o = r[i].flat(1 / 0);
          n = n.concat(this.walkTokens(o, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let i = t.renderers[r.name];
          i ? t.renderers[r.name] = function(...o) {
            let p = r.renderer.apply(this, o);
            return p === false && (p = i.apply(this, o)), p;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = t[r.level];
          i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new P(this.defaults);
        for (let i in n.renderer) {
          if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let o = i, p = n.renderer[o], a = r[o];
          r[o] = (...u) => {
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new y(this.defaults);
        for (let i in n.tokenizer) {
          if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let o = i, p = n.tokenizer[o], a = r[o];
          r[o] = (...u) => {
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new S();
        for (let i in n.hooks) {
          if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let o = i, p = n.hooks[o], a = r[o];
          S.passThroughHooks.has(i) ? r[o] = (u) => {
            if (this.defaults.async && S.passThroughHooksRespectAsync.has(i)) return (async () => {
              let h = await p.call(r, u);
              return a.call(r, h);
            })();
            let c = p.call(r, u);
            return a.call(r, c);
          } : r[o] = (...u) => {
            if (this.defaults.async) return (async () => {
              let h = await p.apply(r, u);
              return h === false && (h = await a.apply(r, u)), h;
            })();
            let c = p.apply(r, u);
            return c === false && (c = a.apply(r, u)), c;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, i = n.walkTokens;
        s.walkTokens = function(o) {
          let p = [];
          return p.push(i.call(this, o)), r && (p = p.concat(r.call(this, o))), p;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, o = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === true && r.async === false) return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return o(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return o(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
        let p = i.hooks ? await i.hooks.preprocess(n) : n, u = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(p, i), c = i.hooks ? await i.hooks.processAllTokens(u) : u;
        i.walkTokens && await Promise.all(this.walkTokens(c, i.walkTokens));
        let k = await (i.hooks ? await i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(c, i);
        return i.hooks ? await i.hooks.postprocess(k) : k;
      })().catch(o);
      try {
        i.hooks && (n = i.hooks.preprocess(n));
        let a = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
        i.hooks && (a = i.hooks.processAllTokens(a)), i.walkTokens && this.walkTokens(a, i.walkTokens);
        let c = (i.hooks ? i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(a, i);
        return i.hooks && (c = i.hooks.postprocess(c)), c;
      } catch (p) {
        return o(p);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var E = new Z();
function f(l3, e) {
  return E.parse(l3, e);
}
f.options = f.setOptions = function(l3) {
  return E.setOptions(l3), f.defaults = E.defaults, j(f.defaults), f;
};
f.getDefaults = C;
f.defaults = R;
function kt(...l3) {
  return E.use(...l3), f.defaults = E.defaults, j(f.defaults), f;
}
f.use = kt;
f.walkTokens = function(l3, e) {
  return E.walkTokens(l3, e);
};
f.parseInline = E.parseInline;
f.Parser = b;
f.parser = b.parse;
f.Renderer = P;
f.TextRenderer = L;
f.Lexer = x;
f.lexer = x.lex;
f.Tokenizer = y;
f.Hooks = S;
f.parse = f;
var nn = f.options;
var rn = f.setOptions;
var sn = f.walkTokens;
var on = f.parseInline;
var ln = b.parse;
var pn = x.lex;

// src/latex-text.ts
var SYMBOLS = {
  alpha: "\u03B1",
  beta: "\u03B2",
  gamma: "\u03B3",
  delta: "\u03B4",
  epsilon: "\u03B5",
  varepsilon: "\u03B5",
  zeta: "\u03B6",
  eta: "\u03B7",
  theta: "\u03B8",
  vartheta: "\u03D1",
  iota: "\u03B9",
  kappa: "\u03BA",
  lambda: "\u03BB",
  mu: "\u03BC",
  nu: "\u03BD",
  xi: "\u03BE",
  pi: "\u03C0",
  rho: "\u03C1",
  sigma: "\u03C3",
  tau: "\u03C4",
  upsilon: "\u03C5",
  phi: "\u03C6",
  varphi: "\u03C6",
  chi: "\u03C7",
  psi: "\u03C8",
  omega: "\u03C9",
  Gamma: "\u0393",
  Delta: "\u0394",
  Theta: "\u0398",
  Lambda: "\u039B",
  Xi: "\u039E",
  Pi: "\u03A0",
  Sigma: "\u03A3",
  Phi: "\u03A6",
  Psi: "\u03A8",
  Omega: "\u03A9",
  approx: "\u2248",
  sim: "\u223C",
  simeq: "\u2243",
  cong: "\u2245",
  equiv: "\u2261",
  neq: "\u2260",
  ne: "\u2260",
  le: "\u2264",
  leq: "\u2264",
  ge: "\u2265",
  geq: "\u2265",
  ll: "\u226A",
  gg: "\u226B",
  times: "\xD7",
  cdot: "\xB7",
  pm: "\xB1",
  mp: "\u2213",
  div: "\xF7",
  infty: "\u221E",
  propto: "\u221D",
  sum: "\u2211",
  prod: "\u220F",
  int: "\u222B",
  partial: "\u2202",
  nabla: "\u2207",
  in: "\u2208",
  notin: "\u2209",
  subset: "\u2282",
  subseteq: "\u2286",
  cup: "\u222A",
  cap: "\u2229",
  forall: "\u2200",
  exists: "\u2203",
  neg: "\xAC",
  land: "\u2227",
  lor: "\u2228",
  to: "\u2192",
  rightarrow: "\u2192",
  leftarrow: "\u2190",
  Rightarrow: "\u21D2",
  implies: "\u21D2",
  iff: "\u21D4",
  mapsto: "\u21A6",
  lvert: "|",
  rvert: "|",
  vert: "|",
  mid: "|",
  lVert: "\u2016",
  rVert: "\u2016",
  Vert: "\u2016",
  langle: "\u27E8",
  rangle: "\u27E9",
  ldots: "\u2026",
  cdots: "\u22EF",
  dots: "\u2026",
  circ: "\u2218",
  star: "\u22C6",
  ast: "\u2217",
  top: "\u22A4",
  perp: "\u22A5",
  emptyset: "\u2205",
  quad: " ",
  qquad: "  ",
  ",": " ",
  ":": " ",
  ";": " ",
  "!": "",
  " ": " "
};
var BLACKBOARD = { R: "\u211D", N: "\u2115", Z: "\u2124", Q: "\u211A", C: "\u2102", E: "\u{1D53C}", P: "\u2119" };
var ACCENTS = { hat: "\u0302", widehat: "\u0302", bar: "\u0304", overline: "\u0304", tilde: "\u0303", widetilde: "\u0303", vec: "\u20D7", dot: "\u0307" };
var TEXT_WRAPPERS = /* @__PURE__ */ new Set(["text", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathcal", "boldsymbol", "operatorname", "textbf", "textit"]);
var SIZING = /* @__PURE__ */ new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle"]);
var SUPERSCRIPT = {
  "0": "\u2070",
  "1": "\xB9",
  "2": "\xB2",
  "3": "\xB3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079",
  "+": "\u207A",
  "-": "\u207B",
  "=": "\u207C",
  "(": "\u207D",
  ")": "\u207E",
  n: "\u207F",
  i: "\u2071",
  T: "\u1D40",
  "\u22A4": "\u1D40",
  "*": "*",
  "\u2032": "\u2032"
};
var SUBSCRIPT = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
  "+": "\u208A",
  "-": "\u208B",
  "=": "\u208C",
  "(": "\u208D",
  ")": "\u208E",
  a: "\u2090",
  e: "\u2091",
  o: "\u2092",
  x: "\u2093",
  h: "\u2095",
  k: "\u2096",
  l: "\u2097",
  m: "\u2098",
  n: "\u2099",
  p: "\u209A",
  s: "\u209B",
  t: "\u209C",
  i: "\u1D62",
  j: "\u2C7C",
  r: "\u1D63",
  u: "\u1D64",
  v: "\u1D65"
};
function latexToUnicode(text) {
  return text.replace(/\$\$([^]*?)\$\$/g, (_match, tex) => convertTex(tex)).replace(/\\\[([^]*?)\\\]/g, (_match, tex) => convertTex(tex)).replace(/\\\(([^]*?)\\\)/g, (_match, tex) => convertTex(tex)).replace(/(^|[^\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\d|\$)/g, (_match, prefix, tex) => `${prefix}${convertTex(tex)}`);
}
function convertTex(tex) {
  let output = "";
  let index = 0;
  while (index < tex.length) {
    const char = tex[index];
    if (char === "\\") {
      const { name, end } = readCommand(tex, index);
      index = end;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = readArgument(tex, index);
        const denominator = readArgument(tex, numerator.end);
        index = denominator.end;
        output += `${wrapCompound(numerator.value)}/${wrapCompound(denominator.value)}`;
      } else if (name === "sqrt") {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += `\u221A${wrapCompound(argument.value)}`;
      } else if (ACCENTS[name]) {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += `${argument.value}${ACCENTS[name]}`;
      } else if (name === "mathbb") {
        const argument = readArgument(tex, index);
        index = argument.end;
        output += [...argument.value].map((letter) => BLACKBOARD[letter] ?? letter).join("");
      } else if (TEXT_WRAPPERS.has(name)) {
        const argument = readArgument(tex, index, true);
        index = argument.end;
        output += argument.value;
      } else if (!SIZING.has(name)) {
        output += SYMBOLS[name] ?? (name.length === 1 ? name : name);
      }
      continue;
    }
    if (char === "^" || char === "_") {
      const argument = readArgument(tex, index + 1);
      index = argument.end;
      output += script(argument.value, char === "^" ? SUPERSCRIPT : SUBSCRIPT, char);
      continue;
    }
    if (char === "{") {
      const argument = readArgument(tex, index);
      index = argument.end;
      output += argument.value;
      continue;
    }
    if (char === "}") {
      index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      if (output && !output.endsWith(" ")) output += " ";
      while (index < tex.length && /\s/.test(tex[index])) index += 1;
      continue;
    }
    output += char;
    index += 1;
  }
  return output.trim();
}
function readCommand(tex, start) {
  const letters = tex.slice(start + 1).match(/^[A-Za-z]+/)?.[0];
  if (letters) return { name: letters, end: start + 1 + letters.length };
  return { name: tex[start + 1] ?? "", end: Math.min(tex.length, start + 2) };
}
function readArgument(tex, start, raw = false) {
  let index = start;
  while (index < tex.length && /\s/.test(tex[index])) index += 1;
  if (tex[index] === "{") {
    let depth = 0;
    for (let end = index; end < tex.length; end += 1) {
      if (tex[end] === "\\") {
        end += 1;
        continue;
      }
      if (tex[end] === "{") depth += 1;
      if (tex[end] === "}") depth -= 1;
      if (depth === 0) {
        const inner2 = tex.slice(index + 1, end);
        return { value: raw ? inner2 : convertTex(inner2), end: end + 1 };
      }
    }
    const inner = tex.slice(index + 1);
    return { value: raw ? inner : convertTex(inner), end: tex.length };
  }
  if (tex[index] === "\\") {
    const { end } = readCommand(tex, index);
    return { value: convertTex(tex.slice(index, end)), end };
  }
  return { value: tex[index] ?? "", end: Math.min(tex.length, index + 1) };
}
function script(value, table, marker) {
  const chars = [...value];
  if (chars.length > 0 && chars.every((char) => table[char])) return chars.map((char) => table[char]).join("");
  return chars.length === 1 ? `${marker}${value}` : `${marker}(${value})`;
}
function wrapCompound(value) {
  return /^[\p{Letter}\p{Number}.′̂̄̃⃗̇]+$/u.test(value) ? value : `(${value})`;
}

// src/proposition-store.ts
import { mkdir as mkdir2, readFile as readFile3, readdir as readdir2, rename as rename2, writeFile as writeFile2 } from "node:fs/promises";
import { resolve as resolve4 } from "node:path";

// src/checkpoint-store.ts
import { mkdir, readFile as readFile2, readdir, realpath as realpath2, rename, rm, stat as stat3, writeFile } from "node:fs/promises";
import { basename as basename3, dirname as dirname2, isAbsolute as isAbsolute2, relative as relative3, resolve as resolve3, sep as sep3 } from "node:path";
var VERDICT_LABELS = {
  supports: "\u652F\u6301",
  weakens: "\u524A\u5F31",
  refutes: "\u5426\u5B9A",
  inconclusive: "\u5C1A\u65E0\u5B9A\u8BBA"
};
var OUTCOME_LABELS = {
  observed: "\u51FA\u73B0",
  partial: "\u90E8\u5206\u51FA\u73B0",
  "not-observed": "\u672A\u51FA\u73B0"
};
var FRONTMATTER = /^---\s*\r?\n([^]*?)\r?\n---\s*\r?\n?/;
var CHECKPOINT_ROOT_ENV = "RESEARCH_LOOP_CHECKPOINT_DIR";
var CheckpointStore = class {
  projectRoot;
  checkpointRoot;
  constructor(projectRoot, configuredRoot = process.env[CHECKPOINT_ROOT_ENV] ?? "checkpoints") {
    this.projectRoot = resolve3(projectRoot);
    this.checkpointRoot = resolveInside(this.projectRoot, configuredRoot);
  }
  async write(draft, artifacts, chain) {
    await mkdir(this.checkpointRoot, { recursive: true });
    await assertCheckpointRootSafe(this.projectRoot, this.checkpointRoot);
    const createdAt = /* @__PURE__ */ new Date();
    const baseId = `checkpoint-${compactTimestamp(createdAt)}-${slugify(latexToUnicode(draft.title))}`;
    const { id, directory } = await reserveDirectory(this.checkpointRoot, baseId);
    const metadata = {
      schema_version: 2,
      id,
      title: draft.title.trim(),
      created_at: createdAt.toISOString(),
      experiment_id: draft.experimentId?.trim() || void 0,
      short_conclusion: draft.answer.trim(),
      artifact_paths: artifacts.map((item) => item.artifact.path),
      proposition_id: chain.proposition.id,
      question_id: chain.question.id,
      question: chain.question.question,
      sequence: chain.sequence,
      verdict: draft.verdict,
      verdict_reason: draft.verdictReason.trim(),
      new_questions: draft.newQuestions.map((item, index) => ({
        id: chain.newQuestionIds[index],
        question: item.question.trim(),
        why_it_arose: item.whyItArose.trim(),
        proposed_experiment: item.proposedExperiment.trim(),
        predictions: item.predictions
      })),
      revision_proposal: draft.revisionProposal
    };
    const markdownPath = resolve3(directory, "checkpoint.md");
    const markdown = buildCheckpointMarkdown(draft, metadata, chain, artifacts, directory);
    const temporaryPath = `${markdownPath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(temporaryPath, markdown, "utf8");
      await rename(temporaryPath, markdownPath);
      return {
        metadata,
        directory,
        markdownPath,
        relativeMarkdownPath: toPosix(relative3(this.projectRoot, markdownPath))
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => void 0);
      throw error;
    }
  }
  async list() {
    let files;
    try {
      await assertCheckpointRootSafe(this.projectRoot, this.checkpointRoot);
      files = await collectMarkdownFiles(this.checkpointRoot, 3, /* @__PURE__ */ new Set([resolve3(this.checkpointRoot, "propositions")]));
    } catch {
      return [];
    }
    const checkpoints = await Promise.all(files.map((path) => this.readDiscovered(path)));
    return checkpoints.filter((item) => item !== void 0).sort((left, right) => Date.parse(right.metadata.created_at) - Date.parse(left.metadata.created_at));
  }
  async latest() {
    return (await this.list())[0];
  }
  async find(id) {
    return (await this.list()).find((item) => item.metadata.id === id);
  }
  async readDiscovered(markdownPath) {
    try {
      const [markdown, fileStat] = await Promise.all([readFile2(markdownPath, "utf8"), stat3(markdownPath)]);
      const parsed = parseCheckpointMarkdown(markdown);
      const directory = dirname2(markdownPath);
      const relativeSource = relative3(this.checkpointRoot, markdownPath);
      const fallbackSource = basename3(markdownPath).toLowerCase() === "checkpoint.md" ? dirname2(relativeSource) : relativeSource.replace(/\.md$/i, "");
      const fallbackId = slugify(toPosix(fallbackSource));
      const title = parsed.metadata?.title || extractTitle(parsed.body) || fallbackId;
      const createdAt = validDate(parsed.metadata?.created_at) ?? fileStat.mtime.toISOString();
      const metadata = {
        ...parsed.metadata,
        schema_version: parsed.metadata?.schema_version === 2 ? 2 : 1,
        id: parsed.metadata?.id || fallbackId,
        title,
        created_at: createdAt,
        experiment_id: parsed.metadata?.experiment_id,
        short_conclusion: parsed.metadata?.short_conclusion || extractShortConclusion(parsed.body),
        artifact_paths: Array.isArray(parsed.metadata?.artifact_paths) ? parsed.metadata.artifact_paths : [],
        new_questions: Array.isArray(parsed.metadata?.new_questions) ? parsed.metadata.new_questions : void 0
      };
      return {
        metadata,
        directory,
        markdownPath,
        relativeMarkdownPath: toPosix(relative3(this.projectRoot, markdownPath)),
        markdown: parsed.body
      };
    } catch {
      return void 0;
    }
  }
};
function buildCheckpointMarkdown(draft, metadata, chain, artifacts, checkpointDirectory) {
  const rewrite = (text) => rewriteArtifactReferences(text.trim(), artifacts, checkpointDirectory);
  const observations = rewrite(draft.observationsMarkdown);
  const newQuestions = metadata.new_questions ?? [];
  const sections = [
    `---
${JSON.stringify(metadata)}
---`,
    `# C${chain.sequence}\uFF1A${draft.title.trim()}`,
    formatChainSummary(draft, chain, newQuestions),
    `## 1. \u4E3A\u4EC0\u4E48\u505A\u8FD9\u4E2A\u5B9E\u9A8C

${formatOrigin(chain)}

${rewrite(draft.whyMarkdown)}`,
    "---",
    `## 2. \u5B9E\u9A8C\u8BBE\u8BA1\u4E0E\u4E8B\u5148\u9884\u671F

${formatDesign(draft, rewrite)}

${formatPredictionTable(chain.predictions)}`,
    "---",
    `## 3. \u5B9E\u9645\u89C2\u5BDF

${observations}`,
    .../^\s*---+\s*$/.test(observations.split(/\r?\n/).at(-1) ?? "") ? [] : ["---"],
    `## 4. \u5BF9\u7167\u9884\u671F\u7684\u5224\u65AD

${formatJudgment(draft, chain, rewrite)}`,
    "---",
    `## 5. \u65B0\u95EE\u9898\u4E0E\u4E0B\u4E00\u6B65\u5B9E\u9A8C

${formatNewQuestions(newQuestions)}`,
    "---",
    `## \u590D\u73B0\u4FE1\u606F

${formatReproduction(draft, artifacts, checkpointDirectory)}`
  ];
  return `${sections.join("\n\n")}
`;
}
function formatChainSummary(draft, chain, newQuestions) {
  const path = [
    chain.proposition.id,
    ...chain.path.map((step) => step.via ? `${step.questionId}\uFF08C${step.via.sequence}\uFF1A${step.via.answer}\uFF09` : `**${step.questionId}\uFF08\u672C\u8F6E\uFF09**`)
  ].join(" \u2192 ");
  return [
    `> **\u547D\u9898 ${chain.proposition.id}**\uFF1A${chain.proposition.statement}  `,
    `> **\u63A8\u7406\u4F4D\u7F6E**\uFF1A${path}  `,
    `> **\u672C\u8F6E\u95EE\u9898 ${chain.question.id}**\uFF1A${chain.question.question}  `,
    `> **\u4E00\u53E5\u8BDD\u7B54\u6848**\uFF1A${draft.answer.trim()}  `,
    `> **\u5BF9\u547D\u9898\u7684\u5F71\u54CD**\uFF1A${VERDICT_LABELS[draft.verdict]}\u3002${draft.verdictReason.trim()}  `,
    `> **\u65B0\u95EE\u9898**\uFF1A${newQuestions.length ? newQuestions.map((item) => item.id).join("\u3001") : "\u65E0"}`
  ].join("\n");
}
function formatOrigin(chain) {
  const origin = chain.question.origin.trim();
  return chain.raisedBy ? `${chain.question.id} \u7531 C${chain.raisedBy.sequence}\uFF08${chain.raisedBy.title}\uFF09\u63D0\u51FA\uFF1A${origin}` : `${chain.question.id} \u6765\u81EA\u547D\u9898 ${chain.proposition.id} \u7684\u62C6\u89E3\uFF1A${origin}`;
}
function formatDesign(draft, rewrite) {
  const { dataset } = draft;
  return [
    "### \u6570\u636E\u96C6",
    "",
    `**${dataset.name.trim()}**`,
    "",
    `* **\u9009\u62E9\u7406\u7531\uFF1A** ${dataset.reason.trim()}`,
    `* **\u57FA\u672C\u4FE1\u606F\uFF1A** ${dataset.description.trim()}`,
    "",
    "### \u5173\u952E\u8D85\u53C2\u6570",
    "",
    "| \u53C2\u6570 | \u53D6\u503C | \u9009\u62E9\u7406\u7531 |",
    "| --- | --- | --- |",
    ...draft.keyHyperparameters.map((item) => `| ${tableCell(item.name)} | ${tableCell(item.value)} | ${tableCell(item.reason)} |`),
    "",
    "### \u8BBE\u8BA1\u601D\u8DEF",
    "",
    rewrite(draft.designMarkdown)
  ].join("\n");
}
function formatPredictionTable(predictions) {
  return [
    "**\u4E8B\u5148\u9884\u671F**\uFF08\u8FDB\u5165\u5B9E\u9A8C\u524D\u767B\u8BB0\uFF0C\u4E4B\u540E\u672A\u4FEE\u6539\uFF09",
    "",
    "| \u9884\u671F | \u82E5\u89C2\u5BDF\u5230 | \u5219\u8BF4\u660E |",
    "| --- | --- | --- |",
    ...predictions.map((prediction, index) => `| \u9884\u671F ${index + 1} | ${tableCell(prediction.observation)} | ${tableCell(prediction.implication)} |`)
  ].join("\n");
}
function formatJudgment(draft, chain, rewrite) {
  const rows = chain.predictions.map((prediction, index) => {
    const outcome = draft.predictionOutcomes[index];
    const label = outcome ? OUTCOME_LABELS[outcome.outcome] : "\u672A\u5224\u65AD";
    return `| \u9884\u671F ${index + 1} | ${tableCell(prediction.observation)} | ${label} | ${tableCell(outcome?.note ?? "")} |`;
  });
  const lines = [
    "| \u9884\u671F | \u82E5\u89C2\u5BDF\u5230 | \u5B9E\u9645 | \u4F9D\u636E |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    rewrite(draft.judgmentMarkdown),
    "",
    `**\u5BF9\u547D\u9898\u7684\u5F71\u54CD\uFF1A** ${VERDICT_LABELS[draft.verdict]}\u3002${draft.verdictReason.trim()}`
  ];
  if (draft.revisionProposal) {
    lines.push(
      "",
      `**\u547D\u9898\u4FEE\u8BA2\u5EFA\u8BAE\uFF08\u5F85\u7528\u6237\u786E\u8BA4\uFF09\uFF1A** ${draft.revisionProposal.statement.trim()}\u3002\u7406\u7531\uFF1A${draft.revisionProposal.reason.trim()}`
    );
  }
  return lines.join("\n");
}
function formatNewQuestions(questions) {
  if (questions.length === 0) return "\u672C\u8F6E\u6CA1\u6709\u63D0\u51FA\u65B0\u95EE\u9898\u3002";
  return questions.map((item) => [
    `### ${item.id}\u3000${item.question}`,
    "",
    `* **\u4E3A\u4EC0\u4E48\u51FA\u73B0\uFF1A** ${item.why_it_arose}`,
    `* **\u5EFA\u8BAE\u5B9E\u9A8C\uFF1A** ${item.proposed_experiment}`,
    `* **\u4E8B\u5148\u9884\u671F\uFF1A** ${item.predictions.map((prediction) => `\u82E5${prediction.observation}\uFF0C\u5219${prediction.implication}`).join("\uFF1B")}`
  ].join("\n")).join("\n\n");
}
function tableCell(value) {
  return value.trim().replace(/\r?\n+/g, " ").split(/(\$\$[^]*?\$\$|\$[^$\n]+\$)/).map((part, index) => index % 2 === 1 ? part : part.replace(/\|/g, "\\|")).join("");
}
function parseCheckpointMarkdown(markdown) {
  const match = markdown.match(FRONTMATTER);
  if (!match) return { body: markdown };
  try {
    const metadata = JSON.parse(match[1].trim());
    return { metadata, body: markdown.slice(match[0].length) };
  } catch {
    return { body: markdown };
  }
}
function validateCheckpointDraft(draft, artifacts, predictionCount) {
  const errors = [];
  const warnings = [];
  const bodies = [
    ["\u4E3A\u4EC0\u4E48\u505A\u8FD9\u4E2A\u5B9E\u9A8C", draft.whyMarkdown],
    ["\u5B9E\u9A8C\u8BBE\u8BA1", draft.designMarkdown],
    ["\u5B9E\u9645\u89C2\u5BDF", draft.observationsMarkdown],
    ["\u5BF9\u7167\u9884\u671F\u7684\u5224\u65AD", draft.judgmentMarkdown]
  ];
  if (!draft.title.trim()) errors.push("Checkpoint title \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (/\r|\n/.test(draft.title)) errors.push("Checkpoint title \u5FC5\u987B\u4FDD\u6301\u4E3A\u5355\u884C\u3002");
  const userText = [
    ...collectStrings(draft),
    ...artifacts.flatMap((item) => collectStrings({
      path: item.path,
      title: item.title,
      description: item.description,
      takeaway: item.takeaway
    }))
  ];
  if (userText.some(containsForbiddenContrast)) {
    errors.push("Checkpoint \u7981\u6B62\u4F7F\u7528\u201C\u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026\u201D\u6216\u540C\u7C7B\u8F6C\u6298\u53E5\u5F0F\uFF1B\u8BF7\u76F4\u63A5\u9648\u8FF0\u89C2\u5BDF\u548C\u7ED3\u8BBA\u3002");
  }
  for (const [label, body] of bodies) {
    if (!body.trim()) errors.push(`${label}\u6B63\u6587\u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    if (/^#{1,2}\s+/m.test(body)) warnings.push(`${label}\u6B63\u6587\u5305\u542B\u4E00\u7EA7\u6216\u4E8C\u7EA7\u6807\u9898\uFF1BViewer \u4F1A\u4FDD\u7559\uFF0C\u4F46\u5EFA\u8BAE\u53EA\u4F7F\u7528\u4E09\u7EA7\u4EE5\u4E0B\u5C0F\u6807\u9898\u3002`);
  }
  for (const [field, value] of [["answer", draft.answer], ["verdictReason", draft.verdictReason]]) {
    if (!value.trim()) errors.push(`${field} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    if (/\r|\n/.test(value)) errors.push(`${field} \u5FC5\u987B\u4FDD\u6301\u4E3A\u5355\u884C\u3002`);
  }
  if (draft.predictionOutcomes.length !== predictionCount) {
    errors.push(`predictionOutcomes \u5FC5\u987B\u6309\u987A\u5E8F\u9010\u6761\u5BF9\u5E94\u8FDB\u5165\u5B9E\u9A8C\u65F6\u767B\u8BB0\u7684 ${predictionCount} \u6761\u9884\u671F\uFF0C\u5F53\u524D\u4E3A ${draft.predictionOutcomes.length} \u6761\u3002`);
  }
  draft.predictionOutcomes.forEach((outcome, index) => {
    if (!outcome.note.trim()) errors.push(`\u9884\u671F ${index + 1} \u7684\u5224\u65AD\u4F9D\u636E\u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  });
  draft.newQuestions.forEach((item, index) => {
    if (![item.question, item.whyItArose, item.proposedExperiment].every((value) => value.trim())) {
      errors.push(`\u65B0\u95EE\u9898 ${index + 1} \u7684 question\u3001whyItArose \u548C proposedExperiment \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    }
    if (item.predictions.some((prediction) => !prediction.observation.trim() || !prediction.implication.trim())) {
      errors.push(`\u65B0\u95EE\u9898 ${index + 1} \u7684\u9884\u671F\u5FC5\u987B\u540C\u65F6\u5199\u660E\u89C2\u5BDF\u548C\u542B\u4E49\u3002`);
    }
  });
  if (draft.revisionProposal && (!draft.revisionProposal.statement.trim() || !draft.revisionProposal.reason.trim())) {
    errors.push("\u547D\u9898\u4FEE\u8BA2\u5EFA\u8BAE\u5FC5\u987B\u540C\u65F6\u5305\u542B\u4FEE\u8BA2\u540E\u7684 statement \u548C reason\u3002");
  }
  const reproductionFields = [
    ["model", draft.reproduction.model],
    ["modelRevision", draft.reproduction.modelRevision],
    ["dataset", draft.reproduction.dataset],
    ["dataRevision", draft.reproduction.dataRevision],
    ["codeCommit", draft.reproduction.codeCommit]
  ];
  if (![draft.dataset.name, draft.dataset.reason, draft.dataset.description].every((value) => value.trim())) {
    errors.push("dataset \u7684 name\u3001reason \u548C description \u4E0D\u80FD\u4E3A\u7A7A\uFF1B\u5408\u6210\u6570\u636E\u8BF7\u63CF\u8FF0\u751F\u6210\u8FC7\u7A0B\u3002");
  }
  if (draft.keyHyperparameters.length === 0) {
    errors.push("keyHyperparameters \u81F3\u5C11\u9700\u8981\u4E00\u9879\u4F1A\u5F71\u54CD\u7ED3\u8BBA\u7684\u53C2\u6570\u3002");
  }
  draft.keyHyperparameters.forEach((item, index) => {
    if (![item.name, item.value, item.reason].every((value) => value.trim())) {
      errors.push(`\u5173\u952E\u8D85\u53C2\u6570 ${index + 1} \u7684 name\u3001value \u548C reason \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    }
  });
  reproductionFields.forEach(([field, value]) => {
    if (!value.trim()) errors.push(`\u590D\u73B0\u4FE1\u606F ${field} \u4E0D\u80FD\u4E3A\u7A7A\uFF1B\u4E0D\u9002\u7528\u65F6\u8BF7\u586B\u5199 not-applicable\u3002`);
  });
  if (draft.protocols.length === 0) errors.push("\u81F3\u5C11\u9700\u8981\u4E00\u4E2A protocol record\u3002");
  draft.protocols.forEach((protocol, index) => {
    const label = `Protocol ${index + 1} (${protocol.title || "\u672A\u547D\u540D"})`;
    if (!protocol.title.trim()) errors.push(`${label} title \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    if (!protocol.dataScope.trim()) errors.push(`${label} dataScope \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    if (protocol.intent === "reproduction") {
      for (const kind of ["paper", "readme", "issue"]) {
        if (!protocol.sources.some((source) => source.kind === kind)) {
          errors.push(`${label} \u7F3A\u5C11 ${kind} source coverage\u3002`);
        }
      }
    }
    protocol.sources.forEach((source) => {
      if (!source.summary.trim()) errors.push(`${label} \u7684 ${source.kind} source summary \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    });
    protocol.deviations.forEach((deviation) => {
      if (![deviation.field, deviation.reference, deviation.actual, deviation.reason].every((value) => value.trim())) {
        errors.push(`${label} \u7684 protocol deviation \u5B57\u6BB5\u4E0D\u80FD\u4E3A\u7A7A\u3002`);
      }
      if (!deviation.approvedByUser) warnings.push(`${label} \u5305\u542B\u672A\u6279\u51C6\u7684\u534F\u8BAE\u504F\u5DEE\uFF1A${deviation.field}\u3002`);
    });
  });
  draft.reproduction.parameters.forEach((parameter) => {
    if (!parameter.name.trim() || !parameter.value.trim()) errors.push("\u590D\u73B0\u53C2\u6570 name \u548C value \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  });
  validateCheckpointCharts(draft.observationsMarkdown, errors, warnings);
  validateVisualNarrative(draft.observationsMarkdown, errors);
  const artifactPaths = /* @__PURE__ */ new Set();
  for (const item of artifacts) {
    if (!item.title.trim() || !item.description.trim()) errors.push(`Artifact ${item.artifact.path} \u7684 title \u548C description \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    if (artifactPaths.has(item.artifact.path)) errors.push(`Artifact \u91CD\u590D\u767B\u8BB0\uFF1A${item.artifact.path}\u3002`);
    artifactPaths.add(item.artifact.path);
    if (item.role !== "evidence" || !isImage(item.artifact.extension)) continue;
    const referenced = referencesMarkdownImage(draft.observationsMarkdown, item.path) || referencesMarkdownImage(draft.observationsMarkdown, item.artifact.path);
    if (!referenced) {
      errors.push(`\u91CD\u8981\u56FE\u7247 ${item.artifact.path} \u5FC5\u987B\u76F4\u63A5\u5F15\u7528\u5728 observationsMarkdown \u4E2D\uFF0C\u800C\u4E0D\u80FD\u53EA\u4F5C\u4E3A\u9644\u4EF6\u3002`);
    }
  }
  return { errors, warnings };
}
function validateCheckpointCharts(markdown, errors, warnings) {
  const blocks = markdown.matchAll(/```checkpoint-chart\s*\r?\n([^]*?)```/gi);
  let index = 0;
  for (const match of blocks) {
    index += 1;
    let config;
    try {
      config = JSON.parse(match[1].trim());
    } catch {
      errors.push(`checkpoint-chart ${index} \u5FC5\u987B\u5305\u542B\u6709\u6548 JSON\u3002`);
      continue;
    }
    if (!config || typeof config !== "object") {
      errors.push(`checkpoint-chart ${index} \u914D\u7F6E\u5FC5\u987B\u662F JSON object\u3002`);
      continue;
    }
    const chart = config;
    if (typeof chart.title !== "string" || !isFormalVisualTitle(chart.title, "\u56FE")) {
      errors.push(`checkpoint-chart ${index} \u7684 title \u5FC5\u987B\u4F7F\u7528\u201C\u56FE N\u3000\u6807\u9898\u201D\u683C\u5F0F\u3002`);
    }
    if (chart.type === "bar") {
      if (!Array.isArray(chart.items) || chart.items.length === 0) {
        errors.push(`checkpoint-chart ${index} \u7684 bar chart \u5FC5\u987B\u5305\u542B items\u3002`);
        continue;
      }
      if (chart.items.some((item) => !item || typeof item !== "object" || !isFiniteNumber(item.value))) {
        errors.push(`checkpoint-chart ${index} \u7684\u6BCF\u4E2A bar item \u90FD\u5FC5\u987B\u5305\u542B\u6709\u9650\u6570\u503C value\u3002`);
      }
      if (chart.items.length > 24) warnings.push(`checkpoint-chart ${index} \u53EA\u4F1A\u663E\u793A\u524D 24 \u4E2A bar items\u3002`);
    } else if (chart.type === "line") {
      if (!Array.isArray(chart.series) || chart.series.length === 0) {
        errors.push(`checkpoint-chart ${index} \u7684 line chart \u5FC5\u987B\u5305\u542B series\u3002`);
        continue;
      }
      const invalid = chart.series.some((series) => {
        if (!series || typeof series !== "object") return true;
        const points = series.points;
        return !Array.isArray(points) || points.length === 0 || points.some((point) => {
          if (!point || typeof point !== "object") return true;
          const value = point;
          return !isFiniteNumber(value.x) || !isFiniteNumber(value.y);
        });
      });
      if (invalid) errors.push(`checkpoint-chart ${index} \u7684\u6BCF\u4E2A line series \u90FD\u5FC5\u987B\u5305\u542B\u6709\u9650\u6570\u503C x/y points\u3002`);
      if (chart.series.length > 12) warnings.push(`checkpoint-chart ${index} \u53EA\u4F1A\u663E\u793A\u524D 12 \u4E2A line series\u3002`);
      if (chart.series.some((series) => Array.isArray(series?.points) && series.points.length > 500)) {
        warnings.push(`checkpoint-chart ${index} \u7684\u6BCF\u6761 line series \u53EA\u4F1A\u663E\u793A\u524D 500 \u4E2A points\u3002`);
      }
    } else {
      errors.push(`checkpoint-chart ${index} \u7684 type \u5FC5\u987B\u662F bar \u6216 line\u3002`);
    }
  }
}
function validateVisualNarrative(markdown, errors) {
  const lines = markdown.split(/\r?\n/);
  const visuals = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const fence = trimmed.match(/^(```+|~~~+)\s*([^\s]*)/);
    if (fence) {
      const marker = fence[1];
      let end = index + 1;
      while (end < lines.length && !lines[end].trim().startsWith(marker)) end += 1;
      if (fence[2].toLowerCase() === "checkpoint-chart") {
        let title;
        try {
          const config = JSON.parse(lines.slice(index + 1, end).join("\n"));
          if (typeof config.title === "string") title = config.title;
        } catch {
        }
        visuals.push({ kind: "\u56FE", start: index, end: Math.min(end, lines.length - 1), title });
      }
      index = Math.min(end, lines.length - 1);
      continue;
    }
    const image = trimmed.match(/!\[([^\]]*)\]\([^)]*\)/);
    if (image) {
      const explicitTitle = trimmed.match(/\s+["']([^"']+)["']\s*\)$/)?.[1];
      const title = explicitTitle || image[1].trim();
      const previous = previousNonEmptyLine(lines, index - 1);
      if (previous && /^#{3,6}\s+图\s*/.test(previous.text)) {
        errors.push(`${title || "Markdown \u56FE\u7247"} \u7684\u6807\u9898\u5FC5\u987B\u4F4D\u4E8E\u56FE\u4E0B\u65B9\uFF1B\u8BF7\u5220\u9664\u56FE\u7247\u4E0A\u65B9\u7684\u56FE\u6807\u9898\u3002`);
      }
      visuals.push({ kind: "\u56FE", start: index, end: index, title });
      continue;
    }
    if (index + 1 < lines.length && looksLikeTableHeader(trimmed, lines[index + 1].trim())) {
      let end = index + 1;
      while (end + 1 < lines.length && lines[end + 1].includes("|") && lines[end + 1].trim()) end += 1;
      const previous = previousNonEmptyLine(lines, index - 1);
      const title = previous?.text.match(/^#{3,6}\s+(.+)$/)?.[1]?.trim();
      visuals.push({ kind: "\u8868", start: previous && title ? previous.index : index, end, title });
      index = end;
    }
  }
  const seenTitles = /* @__PURE__ */ new Set();
  visuals.forEach((visual, index) => {
    const label = visual.title || `${visual.kind} ${index + 1}`;
    if (!visual.title || !isFormalVisualTitle(visual.title, visual.kind)) {
      const position = visual.kind === "\u8868" ? "\u8868\u683C\u4E0A\u65B9" : "\u56FE\u4E0B\u65B9\u7684 Markdown caption";
      errors.push(`${label} \u7F3A\u5C11\u6B63\u5F0F\u6807\u9898\uFF1B\u8BF7\u5728${position}\u4F7F\u7528\u201C${visual.kind} N\u3000\u6807\u9898\u201D\u683C\u5F0F\u3002`);
    } else {
      const normalized = visual.title.replace(/\s+/g, "");
      if (seenTitles.has(normalized)) errors.push(`\u56FE\u8868\u6807\u9898\u91CD\u590D\uFF1A${visual.title}\u3002`);
      seenTitles.add(normalized);
    }
    const nextStart = visuals[index + 1]?.start ?? lines.length;
    let separator = -1;
    for (let line = visual.end + 1; line < nextStart; line += 1) {
      if (/^\s*---+\s*$/.test(lines[line])) {
        separator = line;
        break;
      }
    }
    if (separator < 0) {
      errors.push(`${label} \u7684\u89E3\u6790\u540E\u5FC5\u987B\u6DFB\u52A0\u4E00\u6761\u72EC\u7ACB\u7684\u6D45\u8272\u5206\u9694\u7EBF\u201C---\u201D\uFF0C\u518D\u7EE7\u7EED\u4E0B\u4E00\u4E2A\u56FE\u8868\u6216\u7ED3\u8BBA\u3002`);
      return;
    }
    const analysis = lines.slice(visual.end + 1, separator).join(" ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>]/g, "").trim();
    if (analysis.length < 16 || !/(?:表明|说明|意味着|支持|提示|反映|揭示|指向|符合)/.test(analysis)) {
      errors.push(`${label} \u540E\u9700\u8981\u5355\u72EC\u7684\u89E3\u6790\u6BB5\u843D\uFF0C\u8BF4\u660E\u56FE\u8868\u5185\u5BB9\u53CA\u5176\u7814\u7A76\u542B\u4E49\u3002`);
    }
  });
}
function looksLikeTableHeader(header, divider) {
  return header.includes("|") && /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(divider);
}
function previousNonEmptyLine(lines, start) {
  for (let index = start; index >= 0; index -= 1) {
    const text = lines[index].trim();
    if (text) return { index, text };
  }
  return void 0;
}
function isFormalVisualTitle(value, kind) {
  return new RegExp(`^${kind}\\s*[0-9\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341\u767E]+[\\s\u3000.:\uFF1A\u3001\u2014-]+\\S`).test(value.trim());
}
function collectStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStrings);
}
function containsForbiddenContrast(value) {
  return /(?:并非|并不是|不是|并没有|没有)[^。！？；\n]{0,120}(?:而是|而在于)/.test(value) || /不在于[^。！？；\n]{0,120}而在于/.test(value) || /(?:而不是|而非)/.test(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function formatReproduction(draft, artifacts, checkpointDirectory) {
  const reproduction = draft.reproduction;
  const parameters = reproduction.parameters.length ? reproduction.parameters.map((item) => `${item.name}=${item.value}`).join("\uFF1B") : "\u672A\u8BB0\u5F55";
  const lines = [
    `**\u6A21\u578B\uFF1A** ${inlineCode(reproduction.model)}  `,
    `**\u6A21\u578B\u7248\u672C\uFF1A** ${inlineCode(reproduction.modelRevision)}  `,
    `**\u6570\u636E\u96C6\uFF1A** ${inlineCode(reproduction.dataset)}  `,
    `**\u6570\u636E\u7248\u672C\uFF1A** ${inlineCode(reproduction.dataRevision)}  `,
    `**\u4EE3\u7801\u7248\u672C\uFF1A** ${inlineCode(reproduction.codeCommit)}  `,
    `**\u968F\u673A\u79CD\u5B50\uFF1A** ${inlineCode(reproduction.seeds.join(", ") || "\u672A\u8BB0\u5F55")}  `,
    `**\u4E3B\u8981\u53C2\u6570\uFF1A** ${inlineCode(parameters)}  `
  ];
  if (reproduction.environment?.trim()) lines.push(`**\u8FD0\u884C\u73AF\u5883\uFF1A** ${reproduction.environment.trim()}  `);
  lines.push("", "**\u4E3B\u8981\u7ED3\u679C\u6587\u4EF6\uFF1A**", "");
  if (artifacts.length === 0) lines.push("* \u672C\u6B21 checkpoint \u672A\u767B\u8BB0\u7ED3\u679C\u6587\u4EF6\u3002");
  else {
    artifacts.forEach((item) => {
      const explanation = `${item.title}\uFF1A${item.description}${item.takeaway?.trim() ? `\uFF1B\u8981\u70B9\uFF1A${item.takeaway.trim()}` : ""}`;
      if (item.artifact.kind === "dataset") {
        lines.push(`* ${inlineCode(`${item.artifact.path}/`)}\uFF1A${explanation}`);
        return;
      }
      const target = toPosix(relative3(checkpointDirectory, item.absolutePath));
      lines.push(`* [${inlineCode(item.artifact.path)}](${encodeMarkdownDestination(target)})\uFF1A${explanation}`);
    });
  }
  lines.push("", "### Protocol \u5BA1\u8BA1", "");
  draft.protocols.forEach((protocol) => {
    lines.push(`**${protocol.title}**\uFF08${protocol.intent}\uFF09  `);
    lines.push(`\u6570\u636E\u8303\u56F4\uFF1A${protocol.dataScope}  `);
    if (protocol.reference) lines.push(`\u53C2\u8003\u534F\u8BAE\uFF1A${protocol.reference}  `);
    if (protocol.sources.length) {
      lines.push("\u6765\u6E90\uFF1A");
      protocol.sources.forEach((source) => {
        lines.push(`* ${source.kind} / ${source.status}\uFF1A${source.reference ?? "\u672A\u63D0\u4F9B\u5F15\u7528"}\uFF1B${source.summary}`);
      });
    }
    if (protocol.deviations.length) {
      lines.push("\u534F\u8BAE\u504F\u5DEE\uFF1A");
      protocol.deviations.forEach((deviation) => {
        lines.push(`* ${deviation.field}\uFF1A\u53C2\u8003\u503C ${deviation.reference}\uFF1B\u5B9E\u9645\u503C ${deviation.actual}\uFF1B${deviation.reason}\uFF1B${deviation.approvedByUser ? "\u5DF2\u6279\u51C6" : "\u672A\u6279\u51C6"}`);
      });
    }
    lines.push("");
  });
  return lines.join("\n").trim();
}
function rewriteArtifactReferences(markdown, artifacts, checkpointDirectory) {
  let rewritten = markdown;
  for (const item of artifacts) {
    const rawCandidates = /* @__PURE__ */ new Set([item.path, item.artifact.path]);
    const target = encodeMarkdownDestination(toPosix(relative3(checkpointDirectory, item.absolutePath)));
    for (const rawCandidate of rawCandidates) {
      const candidates = /* @__PURE__ */ new Set([rawCandidate, encodeMarkdownDestination(toPosix(rawCandidate))]);
      for (const candidate of candidates) {
        const linkTarget = new RegExp(`(\\]\\(<?)(?:artifact:\\/\\/)?${escapeRegExp(candidate)}(?=>?(?:\\s+["'][^)]*["'])?\\))`, "g");
        rewritten = rewritten.replace(linkTarget, (_match, prefix) => `${prefix}${target}`);
      }
    }
  }
  return rewritten;
}
function inlineCode(value) {
  const longestRun = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padded = longestRun > 0 || /^\s|\s$/.test(value) ? ` ${value} ` : value;
  return `${fence}${padded}${fence}`;
}
function encodeMarkdownDestination(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}
async function reserveDirectory(root, baseId) {
  for (let index = 1; index < 1e4; index += 1) {
    const id = index === 1 ? baseId : `${baseId}-${index}`;
    const directory = resolve3(root, id);
    try {
      await mkdir(directory, { recursive: false });
      return { id, directory };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error("\u65E0\u6CD5\u4E3A checkpoint \u5206\u914D\u552F\u4E00\u76EE\u5F55\u3002");
}
async function collectMarkdownFiles(root, depth, excluded) {
  if (depth < 0) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve3(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path);
    else if (entry.isDirectory() && !excluded.has(path)) files.push(...await collectMarkdownFiles(path, depth - 1, excluded));
  }
  return files;
}
function resolveInside(root, configured) {
  const target = isAbsolute2(configured) ? resolve3(configured) : resolve3(root, configured);
  if (target === root || !target.startsWith(`${root}${sep3}`)) {
    throw new Error(`Checkpoint directory must be a subdirectory inside the project: ${configured}`);
  }
  return target;
}
async function assertCheckpointRootSafe(projectRoot, checkpointRoot) {
  const [realProjectRoot, realCheckpointRoot] = await Promise.all([realpath2(projectRoot), realpath2(checkpointRoot)]);
  if (!realCheckpointRoot.startsWith(`${realProjectRoot}${sep3}`)) {
    throw new Error("Checkpoint directory resolves outside the project.");
  }
}
function compactTimestamp(value) {
  return value.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}
function slugify(value) {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "research-note";
}
function extractTitle(markdown) {
  return markdown.match(/^#\s+(?:Checkpoint[：:]\s*)?(.+)$/m)?.[1]?.trim();
}
function extractShortConclusion(markdown) {
  const conclusion = markdown.match(/^##\s+4\.\s*结论与下一步\s*$([^]*?)(?=^---\s*$|^##\s+|$)/m)?.[1] ?? markdown.match(/^##\s+结论[^\n]*$([^]*?)(?=^##\s+|$)/m)?.[1] ?? "";
  const paragraph = conclusion.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).find(Boolean);
  return paragraph?.replace(/^>\s*/, "").replace(/[*_`]/g, "").slice(0, 300) || "\u672A\u63D0\u4F9B\u7B80\u77ED\u7ED3\u8BBA\u3002";
}
function validDate(value) {
  if (typeof value !== "string") return void 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : void 0;
}
function referencesMarkdownImage(markdown, path) {
  const candidates = /* @__PURE__ */ new Set([path, encodeMarkdownDestination(toPosix(path))]);
  return [...candidates].some((candidate) => {
    const target = escapeRegExp(candidate);
    return new RegExp(`!\\[[^\\]]*\\]\\((?:<)?(?:artifact:\\/\\/)?${target}(?:>)?(?:\\s+["'][^)]*["'])?\\)`).test(markdown);
  });
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isImage(extension) {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension.toLowerCase());
}
function toPosix(path) {
  return path.split(sep3).join("/");
}

// src/proposition-store.ts
var PROPOSITION_DIRECTORY = "propositions";
var PropositionStore = class {
  constructor(checkpoints) {
    this.checkpoints = checkpoints;
    this.directory = resolve4(checkpoints.checkpointRoot, PROPOSITION_DIRECTORY);
  }
  directory;
  async list() {
    let names;
    try {
      names = await readdir2(this.directory);
    } catch {
      return [];
    }
    const records = await Promise.all(names.filter((name) => /^P\d+\.md$/i.test(name)).map((name) => this.read(resolve4(this.directory, name))));
    return records.filter((record) => record !== void 0).sort((left, right) => propositionNumber(left.id) - propositionNumber(right.id));
  }
  async find(id) {
    if (!/^P\d+$/.test(id)) return void 0;
    return this.read(resolve4(this.directory, `${id}.md`));
  }
  async latest() {
    return (await this.list()).sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
  }
  async tree(id) {
    const proposition = await this.find(id);
    if (!proposition) return void 0;
    return buildPropositionTree(proposition, await this.checkpoints.list());
  }
  async create(input) {
    const existing = await this.list();
    const id = `P${Math.max(0, ...existing.map((record2) => propositionNumber(record2.id))) + 1}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      schema_version: 1,
      id,
      statement: input.statement.trim(),
      background: input.background?.trim() || void 0,
      created_at: now,
      updated_at: now,
      questions: input.questions.map((item, index) => ({
        id: `Q${index + 1}`,
        question: item.question.trim(),
        rationale: item.rationale.trim(),
        source: "initial",
        created_at: now
      })),
      revisions: []
    };
    await this.write(record);
    return record;
  }
  async revise(id, statement, reason) {
    const record = await this.require(id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    record.revisions.push({ at: now, previous: record.statement, statement: statement.trim(), reason: reason.trim() });
    record.statement = statement.trim();
    record.updated_at = now;
    await this.write(record);
    return record;
  }
  async addQuestion(id, question, rationale, source) {
    const tree = await this.tree(id);
    if (!tree) throw new Error(`\u547D\u9898 ${id} \u4E0D\u5B58\u5728\u3002`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const added = {
      id: `Q${nextQuestionNumber(tree)}`,
      question: question.trim(),
      rationale: rationale.trim(),
      source,
      created_at: now
    };
    tree.proposition.questions.push(added);
    tree.proposition.updated_at = now;
    await this.write(tree.proposition);
    return added;
  }
  async require(id) {
    const record = await this.find(id);
    if (!record) throw new Error(`\u547D\u9898 ${id} \u4E0D\u5B58\u5728\u3002`);
    return record;
  }
  async read(path) {
    try {
      const { metadata } = parseCheckpointMarkdown(await readFile3(path, "utf8"));
      const record = metadata;
      if (!record || typeof record.id !== "string" || typeof record.statement !== "string") return void 0;
      return {
        schema_version: 1,
        id: record.id,
        statement: record.statement,
        background: record.background,
        created_at: record.created_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
        updated_at: record.updated_at ?? record.created_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
        questions: Array.isArray(record.questions) ? record.questions : [],
        revisions: Array.isArray(record.revisions) ? record.revisions : []
      };
    } catch {
      return void 0;
    }
  }
  async write(record) {
    await mkdir2(this.directory, { recursive: true });
    const path = resolve4(this.directory, `${record.id}.md`);
    const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile2(temporaryPath, formatPropositionMarkdown(record), "utf8");
    await rename2(temporaryPath, path);
  }
};
function buildPropositionTree(proposition, discovered) {
  const owned = discovered.filter((item) => item.metadata.proposition_id === proposition.id && item.metadata.question_id).sort((left, right) => Date.parse(left.metadata.created_at) - Date.parse(right.metadata.created_at));
  const checkpoints = owned.map((item, index) => ({
    id: item.metadata.id,
    sequence: item.metadata.sequence ?? index + 1,
    title: item.metadata.title,
    created_at: item.metadata.created_at,
    question_id: item.metadata.question_id,
    answer: item.metadata.short_conclusion,
    verdict: item.metadata.verdict,
    verdict_reason: item.metadata.verdict_reason,
    new_question_ids: (item.metadata.new_questions ?? []).map((question) => question.id)
  }));
  const questions = proposition.questions.map((question) => ({
    id: question.id,
    question: question.question,
    origin: question.rationale,
    source: question.source,
    answered_by: [],
    status: "open"
  }));
  for (const item of owned) {
    for (const raised of item.metadata.new_questions ?? []) {
      questions.push({
        id: raised.id,
        question: raised.question,
        origin: raised.why_it_arose,
        source: "checkpoint",
        raised_by: item.metadata.id,
        proposed_experiment: raised.proposed_experiment,
        predictions: raised.predictions,
        answered_by: [],
        status: "open"
      });
    }
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const checkpoint of checkpoints) {
    const question = byId.get(checkpoint.question_id);
    if (!question) continue;
    question.answered_by.push(checkpoint.id);
    question.status = "answered";
  }
  questions.sort((left, right) => questionNumber(left.id) - questionNumber(right.id));
  return { proposition, questions, checkpoints };
}
function nextQuestionNumber(tree) {
  return Math.max(0, ...tree.questions.map((question) => questionNumber(question.id))) + 1;
}
function nextCheckpointSequence(tree) {
  return Math.max(0, ...tree.checkpoints.map((checkpoint) => checkpoint.sequence)) + 1;
}
function questionPath(tree, questionId) {
  const questions = new Map(tree.questions.map((question2) => [question2.id, question2]));
  const checkpoints = new Map(tree.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const steps = [];
  const seen = /* @__PURE__ */ new Set();
  let question = questions.get(questionId);
  let via;
  while (question && !seen.has(question.id)) {
    seen.add(question.id);
    steps.unshift({ question, via });
    via = question.raised_by ? checkpoints.get(question.raised_by) : void 0;
    question = via ? questions.get(via.question_id) : void 0;
  }
  return steps;
}
function describePropositionForPolicy(tree, nextQuestionId) {
  if (!tree) {
    return [
      "[RESEARCH PROPOSITION]",
      "No active proposition. Before any experiment, agree with the user on the proposition being tested: one falsifiable sentence plus 1-5 initial questions that decompose it. Record it with research_proposition action=create; the user confirms it."
    ].join("\n");
  }
  const { proposition } = tree;
  const checkpoints = new Map(tree.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const open3 = tree.questions.filter((question) => question.status === "open").slice(0, 8);
  const answered = tree.checkpoints.slice(-5);
  const lines = [
    "[RESEARCH PROPOSITION]",
    `Active proposition ${proposition.id}: ${proposition.statement}`
  ];
  if (answered.length) {
    lines.push("Recent checkpoints:");
    answered.forEach((checkpoint) => {
      lines.push(`- C${checkpoint.sequence} answered ${checkpoint.question_id} (${checkpoint.verdict ?? "no verdict"}): ${checkpoint.answer}`);
    });
  }
  if (open3.length) {
    lines.push("Open questions:");
    open3.forEach((question) => {
      const raisedBy = question.raised_by ? checkpoints.get(question.raised_by) : void 0;
      const origin = raisedBy ? ` [raised by C${raisedBy.sequence}]` : "";
      const proposal = question.proposed_experiment ? ` Proposed experiment: ${question.proposed_experiment}` : "";
      lines.push(`- ${question.id}${origin}: ${question.question}${proposal}`);
    });
  } else {
    lines.push("No open questions. Ask the user which question to examine next, then record it with research_proposition action=add_question.");
  }
  if (nextQuestionId) lines.push(`The user selected ${nextQuestionId} as the next question.`);
  lines.push(
    "Every experiment answers exactly one registered question. Enter Experiment Mode with its questionId, a rationale, and at least two predictions (observation -> implication) that cover supporting and non-supporting outcomes. Record any other question with research_proposition action=add_question before experimenting on it. Suggest proposition revisions only through the checkpoint; the user decides whether to adopt them."
  );
  return lines.join("\n");
}
function formatPropositionMarkdown(record) {
  const lines = [
    `---
${JSON.stringify(record)}
---`,
    "",
    `# \u547D\u9898 ${record.id}\uFF1A${record.statement}`
  ];
  if (record.background) lines.push("", record.background);
  lines.push("", "## \u767B\u8BB0\u7684\u95EE\u9898", "");
  if (record.questions.length === 0) lines.push("\u6682\u65E0\u767B\u8BB0\u95EE\u9898\u3002");
  record.questions.forEach((question) => {
    lines.push(`* **${question.id}** ${question.question}\uFF1A${question.rationale}`);
  });
  if (record.revisions.length) {
    lines.push("", "## \u4FEE\u8BA2\u8BB0\u5F55", "");
    record.revisions.forEach((revision) => {
      lines.push(`* ${revision.at.slice(0, 10)}\uFF1A${revision.previous} \u2192 ${revision.statement}\u3002\u7406\u7531\uFF1A${revision.reason}`);
    });
  }
  lines.push(
    "",
    "> \u672C\u6587\u4EF6\u53EA\u4FDD\u5B58\u547D\u9898\u3001\u767B\u8BB0\u7684\u95EE\u9898\u548C\u4FEE\u8BA2\u8BB0\u5F55\u3002\u5B9E\u9A8C\u7ED3\u8BBA\u548C\u540E\u7EED\u95EE\u9898\u4FDD\u5B58\u5728\u5404 checkpoint \u4E2D\uFF0C\u7531 Viewer \u7EC4\u5408\u6210\u95EE\u9898\u6811\u3002",
    ""
  );
  return lines.join("\n");
}
function propositionNumber(id) {
  return Number.parseInt(id.replace(/^P/i, ""), 10) || 0;
}
function questionNumber(id) {
  return Number.parseInt(id.replace(/^Q/i, ""), 10) || 0;
}

// src/checkpoint-server.ts
var DEFAULT_HOST = "127.0.0.1";
var ALL_INTERFACES_HOST = "0.0.0.0";
var DEFAULT_BASE_PORT = 43119;
var MAX_PORT_ATTEMPTS = 100;
var MAX_JSON_PREVIEW_BYTES = 32 * 1024 * 1024;
var MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;
var CheckpointViewerServer = class {
  constructor(store, options = {}) {
    this.store = store;
    this.propositions = new PropositionStore(store);
    this.host = options.host ?? envHost();
    this.basePort = normalizeBasePort(options.basePort ?? envBasePort());
    this.templateOverride = options.template;
    this.templatePath = options.templatePath ?? fileURLToPath(new URL("./checkpoint-report-template.html", import.meta.url));
  }
  host;
  basePort;
  templateOverride;
  templatePath;
  propositions;
  server;
  port;
  startPromise;
  get origin() {
    if (this.port === void 0) return void 0;
    const accessHost = this.host === ALL_INTERFACES_HOST ? hostname() : this.host;
    return `http://${accessHost}:${this.port}`;
  }
  get exposedToNetwork() {
    return this.host === ALL_INTERFACES_HOST;
  }
  get latestUrl() {
    return this.origin ? `${this.origin}/latest` : void 0;
  }
  async start() {
    if (this.server?.listening) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startListening();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = void 0;
    }
  }
  async stop() {
    await this.startPromise?.catch(() => void 0);
    const server = this.server;
    this.server = void 0;
    this.port = void 0;
    if (!server?.listening) return;
    await new Promise((resolveClose) => server.close(() => resolveClose()));
  }
  async startListening() {
    const template = this.templateOverride ?? await readFile4(this.templatePath, "utf8");
    if (!template.includes("checkpoint-viewer")) {
      throw new Error("Checkpoint Viewer template is missing its viewer root marker.");
    }
    let lastError;
    for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
      const port = this.basePort + offset;
      if (port > 65535) break;
      const server2 = this.createHttpServer(template);
      try {
        await listen(server2, port, this.host);
        server2.unref();
        this.server = server2;
        this.port = port;
        return;
      } catch (error) {
        lastError = error;
        server2.close();
        const code = error.code;
        if (code !== "EADDRINUSE" && code !== "EACCES") throw error;
      }
    }
    const server = this.createHttpServer(template);
    try {
      await listen(server, 0, this.host);
      server.unref();
      this.server = server;
      this.port = server.address().port;
    } catch (error) {
      server.close();
      throw new Error(`Could not bind the Checkpoint Viewer to ${this.host}.`, { cause: lastError ?? error });
    }
  }
  createHttpServer(template) {
    return createServer((request, response) => {
      void this.handleRequest(template, request, response).catch((error) => {
        if (response.headersSent) response.destroy(error);
        else send(response, 500, "text/plain; charset=utf-8", `Checkpoint Viewer error: ${String(error)}`);
      });
    });
  }
  async handleRequest(template, request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "text/plain; charset=utf-8", "Method not allowed", request.method === "HEAD");
      return;
    }
    const url = new URL(request.url ?? "/", `http://${DEFAULT_HOST}`);
    if (url.pathname === "/health") {
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true }), request.method === "HEAD");
      return;
    }
    if (url.pathname === "/" || url.pathname === "/latest" || /^\/checkpoints\/[^/]+$/.test(url.pathname) || /^\/propositions\/P\d+$/.test(url.pathname)) {
      sendHtml(response, template, request.method === "HEAD");
      return;
    }
    if (url.pathname === "/api/checkpoints") {
      const checkpoints = await this.store.list();
      sendJson(response, 200, checkpoints.map((item) => historyEntry(item)), request.method === "HEAD");
      return;
    }
    if (url.pathname === "/api/propositions") {
      const [records, checkpoints] = await Promise.all([this.propositions.list(), this.store.list()]);
      sendJson(response, 200, records.map((record) => {
        const tree = buildPropositionTree(record, checkpoints);
        return {
          id: record.id,
          statement: record.statement,
          statement_html: mathTextHtml(record.statement),
          updated_at: record.updated_at,
          url: `/propositions/${record.id}`,
          questions: tree.questions.length,
          open_questions: tree.questions.filter((question) => question.status === "open").length,
          checkpoints: tree.checkpoints.length,
          latest_answer: tree.checkpoints.at(-1)?.answer,
          latest_answer_html: mathTextHtml(tree.checkpoints.at(-1)?.answer)
        };
      }), request.method === "HEAD");
      return;
    }
    const propositionMatch = url.pathname.match(/^\/api\/propositions\/(P\d+)$/);
    if (propositionMatch) {
      const tree = await this.propositions.tree(propositionMatch[1]);
      if (!tree) {
        sendJson(response, 404, { error: "Proposition not found." }, request.method === "HEAD");
        return;
      }
      sendJson(response, 200, {
        proposition: {
          ...tree.proposition,
          statement_html: mathTextHtml(tree.proposition.statement),
          background_html: mathTextHtml(tree.proposition.background),
          revisions: tree.proposition.revisions.map((revision) => ({
            ...revision,
            previous_html: mathTextHtml(revision.previous),
            statement_html: mathTextHtml(revision.statement),
            reason_html: mathTextHtml(revision.reason)
          }))
        },
        questions: tree.questions.map((question) => ({
          ...question,
          question_html: mathTextHtml(question.question),
          origin_html: mathTextHtml(question.origin),
          proposed_experiment_html: mathTextHtml(question.proposed_experiment)
        })),
        checkpoints: tree.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          title_html: mathTextHtml(checkpoint.title),
          answer_html: mathTextHtml(checkpoint.answer),
          url: `/checkpoints/${encodeURIComponent(checkpoint.id)}`
        }))
      }, request.method === "HEAD");
      return;
    }
    if (url.pathname === "/api/latest") {
      const checkpoint = await this.store.latest();
      if (!checkpoint) {
        sendJson(response, 404, { error: "No checkpoints found." }, request.method === "HEAD");
        return;
      }
      sendJson(response, 200, renderCheckpoint(this.store, checkpoint), request.method === "HEAD");
      return;
    }
    const checkpointMatch = url.pathname.match(/^\/api\/checkpoints\/([^/]+)$/);
    if (checkpointMatch) {
      let id;
      try {
        id = decodeURIComponent(checkpointMatch[1]);
      } catch {
        sendJson(response, 400, { error: "Malformed checkpoint id." }, request.method === "HEAD");
        return;
      }
      const checkpoint = await this.store.find(id);
      if (!checkpoint) {
        sendJson(response, 404, { error: "Checkpoint not found." }, request.method === "HEAD");
        return;
      }
      sendJson(response, 200, renderCheckpoint(this.store, checkpoint), request.method === "HEAD");
      return;
    }
    if (url.pathname.startsWith("/api/artifacts/")) {
      await this.serveArtifactPreview(url.pathname.slice("/api/artifacts/".length), response, request.method === "HEAD");
      return;
    }
    if (url.pathname.startsWith("/artifacts/")) {
      await this.serveArtifact(url.pathname.slice("/artifacts/".length), response, request.method === "HEAD");
      return;
    }
    send(response, 404, "text/plain; charset=utf-8", "Not found", request.method === "HEAD");
  }
  async serveArtifact(encodedPath, response, headOnly) {
    const resolved = await resolveArtifactPath(this.store.projectRoot, encodedPath);
    if (resolved.status === "forbidden") {
      send(response, 403, "text/plain; charset=utf-8", "Artifact path is outside the project.", headOnly);
      return;
    }
    if (resolved.status === "missing") {
      send(response, 404, "text/plain; charset=utf-8", "Artifact not found.", headOnly);
      return;
    }
    const path = resolved.path;
    let fileStat;
    try {
      fileStat = await stat4(path);
    } catch {
      send(response, 404, "text/plain; charset=utf-8", "Artifact not found.", headOnly);
      return;
    }
    if (!fileStat.isFile()) {
      send(response, 404, "text/plain; charset=utf-8", "Artifact is not a file.", headOnly);
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeType(extname4(path)),
      "Content-Length": fileStat.size,
      "Cache-Control": "no-cache",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff"
    });
    if (headOnly) response.end();
    else createReadStream2(path).pipe(response);
  }
  async serveArtifactPreview(encodedPath, response, headOnly) {
    const resolved = await resolveArtifactPath(this.store.projectRoot, encodedPath);
    if (resolved.status === "forbidden") {
      sendJson(response, 403, { error: "Artifact path is outside the project." }, headOnly);
      return;
    }
    if (resolved.status === "missing") {
      sendJson(response, 404, { error: "Artifact not found." }, headOnly);
      return;
    }
    const path = resolved.path;
    let fileStat;
    try {
      fileStat = await stat4(path);
    } catch {
      sendJson(response, 404, { error: "Artifact not found." }, headOnly);
      return;
    }
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: "Artifact is not a file." }, headOnly);
      return;
    }
    const extension = extname4(path).toLowerCase();
    if (extension !== ".json" && extension !== ".csv") {
      sendJson(response, 415, { error: "Preview supports JSON and CSV only." }, headOnly);
      return;
    }
    const limit = extension === ".json" ? MAX_JSON_PREVIEW_BYTES : MAX_TEXT_PREVIEW_BYTES;
    const truncated = fileStat.size > limit;
    const handle = await open2(path, "r");
    try {
      const buffer = Buffer.alloc(Math.min(fileStat.size, limit));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      sendJson(response, 200, {
        kind: extension.slice(1),
        size: fileStat.size,
        truncated,
        text: buffer.toString("utf8", 0, bytesRead)
      }, headOnly);
    } finally {
      await handle.close();
    }
  }
};
function formatSshPortForwardCommand(reportUrl, sshHost = process.env.RESEARCH_LOOP_SSH_HOST?.trim() || hostname()) {
  const port = new URL(reportUrl).port;
  if (!port) throw new Error(`Checkpoint Viewer URL has no port: ${reportUrl}`);
  return `ssh -N -o RemoteCommand=none -o RequestTTY=no -L ${port}:127.0.0.1:${port} ${sshHost}`;
}
function renderCheckpoint(store, checkpoint) {
  const { html, toc } = renderMarkdown(store, checkpoint);
  return {
    metadata: {
      ...checkpoint.metadata,
      short_conclusion_html: mathTextHtml(checkpoint.metadata.short_conclusion),
      title_text: latexToUnicode(checkpoint.metadata.title)
    },
    markdown_path: checkpoint.relativeMarkdownPath,
    html,
    toc
  };
}
function renderMarkdown(store, checkpoint) {
  const protectedMath = protectMathSegments(checkpoint.markdown);
  const toc = [];
  const usedIds = /* @__PURE__ */ new Map();
  const renderer = new P();
  renderer.html = ({ text }) => `<pre class="raw-html">${escapeHtml(text)}</pre>`;
  renderer.heading = function({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const plain = stripHtml(protectedMath.restore(content));
    const base = headingSlug(plain) || "section";
    const count2 = (usedIds.get(base) ?? 0) + 1;
    usedIds.set(base, count2);
    const id = count2 === 1 ? base : `${base}-${count2}`;
    if (depth >= 2 && depth <= 3) toc.push({ id, text: plain, depth });
    const className = depth === 3 && /^表\s*[0-9一二三四五六七八九十百]+[\s　.:：、—-]/.test(plain) ? ' class="table-title"' : "";
    return `<h${depth} id="${escapeAttribute(id)}"${className}>${content}</h${depth}>
`;
  };
  const defaultCode = renderer.code.bind(renderer);
  renderer.code = (token) => {
    if ((token.lang ?? "").trim().toLowerCase() !== "checkpoint-chart") return defaultCode(token);
    try {
      const config = JSON.parse(token.text);
      const encoded = Buffer.from(JSON.stringify(config), "utf8").toString("base64url");
      return `<figure class="checkpoint-chart" data-chart="${encoded}"></figure>
`;
    } catch {
      return `<pre class="chart-error"><code>${escapeHtml(token.text)}</code></pre>
`;
    }
  };
  renderer.paragraph = function({ tokens }) {
    const content = this.parser.parseInline(tokens);
    return tokens.length === 1 && tokens[0]?.type === "image" ? `${content}
` : `<p>${content}</p>
`;
  };
  renderer.image = ({ href, title, text }) => {
    const target = markdownTarget(store, checkpoint, href);
    if (!target) return `<span class="broken-artifact">[\u65E0\u6CD5\u8BBF\u95EE\u56FE\u7247\uFF1A${escapeHtml(text)}]</span>`;
    const caption = title || text;
    return `<figure class="checkpoint-figure"><img src="${escapeAttribute(target.url)}" alt="${escapeAttribute(text)}" loading="lazy"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
  };
  renderer.link = function({ href, title, tokens }) {
    const label = this.parser.parseInline(tokens);
    const target = markdownTarget(store, checkpoint, href);
    if (!target) return `<span class="broken-artifact">${label}</span>`;
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    const preview2 = target.previewKind ? ` data-preview-kind="${target.previewKind}" data-preview-url="${escapeAttribute(target.previewUrl)}"` : "";
    const external = target.external ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${escapeAttribute(target.url)}"${titleAttribute}${preview2}${external}>${label}</a>`;
  };
  const marked = new Z({ gfm: true, breaks: false, renderer });
  const rendered = String(marked.parse(protectedMath.markdown));
  return { html: protectedMath.restore(rendered), toc };
}
function mathTextHtml(text) {
  if (text === void 0) return void 0;
  const math = protectMathSegments(text);
  return math.restore(escapeHtml(math.markdown));
}
function protectMathSegments(markdown) {
  let marker = "RESEARCHLOOPMATHSEGMENT";
  while (markdown.includes(marker)) marker += "X";
  const codeSegments = [];
  const mathSegments = [];
  const stashCode = (value) => {
    const token = `${marker}CODE${codeSegments.length}END`;
    codeSegments.push(value);
    return token;
  };
  let protectedMarkdown = markdown.replace(/(```|~~~)[^]*?\1/g, stashCode).replace(/(`+)[^]*?\1/g, stashCode);
  const stashMath = (content, display) => {
    const token = `${marker}${mathSegments.length}END`;
    mathSegments.push({ content, display });
    return token;
  };
  protectedMarkdown = protectedMarkdown.replace(/\$\$([^]*?)\$\$/g, (_match, content) => stashMath(content, true)).replace(/\\\[([^]*?)\\\]/g, (_match, content) => stashMath(content, true)).replace(/\\\(([^]*?)\\\)/g, (_match, content) => stashMath(content, false)).replace(/(^|[^\\$])\$(?!\$|\s)([^$\n]*?\S)\$(?!\d|\$)/g, (_match, prefix, content) => {
    return `${prefix}${stashMath(content, false)}`;
  });
  codeSegments.forEach((segment, index) => {
    protectedMarkdown = protectedMarkdown.replace(`${marker}CODE${index}END`, () => segment);
  });
  return {
    markdown: protectedMarkdown,
    restore(html) {
      let restored = html;
      mathSegments.forEach((segment, index) => {
        const delimiter = segment.display ? `\\[${escapeHtml(segment.content)}\\]` : `\\(${escapeHtml(segment.content)}\\)`;
        restored = restored.replaceAll(`${marker}${index}END`, () => delimiter);
      });
      return restored;
    }
  };
}
function markdownTarget(store, checkpoint, href) {
  if (/^(?:https?:|mailto:)/i.test(href)) return { url: href, external: true };
  if (href.startsWith("#")) return { url: href, external: false };
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return void 0;
  let decoded;
  try {
    decoded = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  } catch {
    return void 0;
  }
  const absolute = resolve5(checkpoint.directory, decoded);
  if (!isInside(store.projectRoot, absolute)) return void 0;
  const projectPath = toPosix2(relative4(store.projectRoot, absolute));
  const encoded = encodeProjectPath(projectPath);
  const extension = extname4(absolute).toLowerCase();
  const previewKind = extension === ".json" ? "json" : extension === ".csv" ? "csv" : void 0;
  return {
    url: `/artifacts/${encoded}`,
    external: false,
    previewKind,
    previewUrl: previewKind ? `/api/artifacts/${encoded}` : void 0
  };
}
function historyEntry(checkpoint) {
  return {
    ...checkpoint.metadata,
    title_html: mathTextHtml(checkpoint.metadata.title),
    short_conclusion_html: mathTextHtml(checkpoint.metadata.short_conclusion),
    markdown_path: checkpoint.relativeMarkdownPath,
    url: `/checkpoints/${encodeURIComponent(checkpoint.metadata.id)}`
  };
}
async function resolveArtifactPath(projectRoot, encodedPath) {
  let decoded;
  try {
    decoded = encodedPath.split("/").map((part) => decodeURIComponent(part)).join("/");
  } catch {
    return { status: "forbidden" };
  }
  const lexicalPath = resolve5(projectRoot, decoded);
  if (!isInside(projectRoot, lexicalPath)) return { status: "forbidden" };
  try {
    const [realProjectRoot, realArtifactPath] = await Promise.all([realpath3(projectRoot), realpath3(lexicalPath)]);
    return isInside(realProjectRoot, realArtifactPath) ? { status: "ok", path: realArtifactPath } : { status: "forbidden" };
  } catch {
    return { status: "missing" };
  }
}
function encodeProjectPath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}
function headingSlug(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function stripHtml(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  })[entity] ?? entity).trim();
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function escapeAttribute(value) {
  return escapeHtml(value);
}
function isInside(root, path) {
  const normalizedRoot = resolve5(root);
  const normalizedPath = resolve5(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${sep4}`);
}
function toPosix2(path) {
  return path.split(sep4).join("/");
}
function mimeType(extension) {
  return {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".out": "text/plain; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".jsonl": "application/x-ndjson; charset=utf-8",
    ".pdf": "application/pdf"
  }[extension.toLowerCase()] ?? "application/octet-stream";
}
function envHost() {
  const configured = process.env.RESEARCH_LOOP_CHECKPOINT_HOST?.trim() || DEFAULT_HOST;
  if (configured === DEFAULT_HOST || configured === ALL_INTERFACES_HOST) return configured;
  throw new Error(`RESEARCH_LOOP_CHECKPOINT_HOST must be ${DEFAULT_HOST} or ${ALL_INTERFACES_HOST}: ${configured}`);
}
function envBasePort() {
  const configured = Number.parseInt(process.env.RESEARCH_LOOP_CHECKPOINT_PORT ?? "", 10);
  return Number.isInteger(configured) ? configured : DEFAULT_BASE_PORT;
}
function normalizeBasePort(value) {
  return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : DEFAULT_BASE_PORT;
}
function listen(server, port, host) {
  return new Promise((resolveListen, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
function sendHtml(response, body, headOnly) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(headOnly ? void 0 : body);
}
function sendJson(response, status, value, headOnly) {
  send(response, status, "application/json; charset=utf-8", JSON.stringify(value), headOnly);
}
function send(response, status, contentType, body, headOnly = false) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(headOnly ? void 0 : body);
}

// src/terminal-image.ts
import { spawnSync } from "node:child_process";
import { Image, truncateToWidth } from "@earendil-works/pi-tui";
var chafaAvailable;
function createTerminalImage(data, mimeType2, theme, options) {
  const fallback = new Image(data, mimeType2, theme, options);
  if (!hasChafa()) return fallback;
  return new ChafaImage(data, fallback, options);
}
function buildChafaArguments(format, width, height) {
  return [
    `--format=${format}`,
    "--colors=full",
    `--size=${width}x${height}`,
    "-"
  ];
}
function formatSixelLines(output, rows) {
  const sixel = output.replace(/[\r\n]+$/, "");
  const reservedRows = Math.max(1, rows);
  const rowOffset = reservedRows - 1;
  const moveUp = rowOffset > 0 ? `\x1B[${rowOffset}A` : "";
  return [...Array(rowOffset).fill(""), `${moveUp}${sixel}`];
}
function hasChafa() {
  if (chafaAvailable !== void 0) return chafaAvailable;
  const probe = spawnSync("chafa", ["--version"], {
    encoding: "utf8",
    timeout: 1500,
    windowsHide: true
  });
  chafaAvailable = probe.status === 0 && !probe.error;
  return chafaAvailable;
}
var ChafaImage = class {
  constructor(data, fallback, options) {
    this.data = data;
    this.fallback = fallback;
    this.options = options;
  }
  cachedWidth;
  cachedLines;
  failed = false;
  render(width) {
    if (this.failed) return this.fallback.render(width);
    const targetWidth = Math.max(1, Math.min(width, this.options.maxWidthCells));
    if (this.cachedLines && this.cachedWidth === targetWidth) return this.cachedLines;
    const result = spawnSync(
      "chafa",
      buildChafaArguments(
        this.options.chafaFormat ?? "symbols",
        targetWidth,
        this.options.maxHeightCells
      ),
      {
        input: Buffer.from(this.data, "base64"),
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        timeout: 5e3,
        windowsHide: true
      }
    );
    if (result.status !== 0 || result.error || !result.stdout.trim()) {
      this.failed = true;
      return this.fallback.render(width);
    }
    this.cachedWidth = targetWidth;
    if (this.options.chafaFormat === "sixels") {
      this.cachedLines = formatSixelLines(result.stdout, this.options.maxHeightCells);
      return this.cachedLines;
    }
    this.cachedLines = result.stdout.replaceAll("\r", "").split("\n").filter((line, index, lines) => line.length > 0 || index < lines.length - 1).map((line) => truncateToWidth(line, targetWidth, ""));
    return this.cachedLines;
  }
  invalidate() {
    this.cachedWidth = void 0;
    this.cachedLines = void 0;
    this.fallback.invalidate();
  }
};

// src/checkpoint.ts
var PREDICTION = Type.Object({
  observation: Type.String({ description: "\u82E5\u89C2\u5BDF\u5230\u7684\u5177\u4F53\u73B0\u8C61\uFF0C\u6700\u597D\u5E26\u53EF\u6BD4\u8F83\u7684\u6570\u503C\u6216\u65B9\u5411" }),
  implication: Type.String({ description: "\u5219\u8BF4\u660E\u4EC0\u4E48\uFF0C\u5BF9\u5E94\u5230\u95EE\u9898\u6216\u547D\u9898" })
});
function registerResearchCheckpoint(pi, dependencies) {
  pi.registerTool({
    name: "research_checkpoint",
    label: "Research Checkpoint",
    description: "Record the completed experiment as one link in the active proposition's chain of reasoning: why this question was asked, what was predicted, what was observed, how it bears on the proposition, and which new questions follow. Saves a Chinese Markdown note under checkpoints/ and returns Research Loop to Exploration Mode. Call this alone as the final tool action.",
    promptSnippet: "Write the completed experiment as a proposition-linked Markdown checkpoint",
    promptGuidelines: [
      "Write for a reader who knows the proposition but has not followed this session. The plugin already prints the proposition, the reasoning path, this round's question, and the registered predictions; do not repeat them, build on them.",
      "Write primarily in natural Chinese. Use Chinese (English term) the first time a necessary technical term appears, then use the Chinese term consistently.",
      "whyMarkdown explains what earlier evidence left unresolved and why this experiment can separate the explanations. dataset names the data, why it suits this question, and its basic facts (size, splits, features or inputs, labels or targets; for synthetic data, the generating process with its parameters). keyHyperparameters lists every setting that could change the conclusion, such as sample sizes, model size, regularization, learning rate, training length and number of seeds, each with its value and why it was chosen. designMarkdown explains the design thinking: conditions and controls, what is held fixed, the metric and the decision rule. Complete audit detail belongs in protocols and reproduction.",
      "observationsMarkdown contains only the evidence needed to answer this round's question. Every visual forms an independent \u56FE\uFF08\u8868\uFF09\u2192 \u6B63\u5F0F\u6807\u9898 \u2192 \u89E3\u6790 unit followed by a standalone --- separator. Table titles go above tables as ### \u8868 N\u3000\u6807\u9898; figure titles go below images as the Markdown caption \u56FE N\u3000\u6807\u9898.",
      "predictionOutcomes judge each registered prediction in order. judgmentMarkdown explains the judgment, including anything unexpected, and states what this result cannot establish.",
      "verdict states how this result bears on the proposition. When the result says the proposition should be narrowed or restated, put it in revisionProposal; only the user can adopt it.",
      "newQuestions lists at most three questions that this result genuinely raised, each with why it arose, the experiment that would answer it, and at least two predictions. Leave it empty when no real question follows.",
      "Never use the Chinese contrast construction \u4E0D\u662F\u2026\u2026\u800C\u662F\u2026\u2026 or close variants such as \u5E76\u975E\u2026\u2026\u800C\u662F\u2026\u2026\u3001\u4E0D\u5728\u4E8E\u2026\u2026\u800C\u5728\u4E8E\u2026\u2026\u3001\u800C\u4E0D\u662F and \u800C\u975E anywhere in a checkpoint. State the observation and conclusion directly.",
      "Write every formula, variable, estimator, metric definition and quantitative relation as LaTeX in every field: inline $...$, and display $$...$$ on its own lines for any equation the reader should study. Define each symbol at first use, for example $n$ \u4E3A\u8BAD\u7EC3\u6837\u672C\u6570\u3001$d$ \u4E3A\u7279\u5F81\u7EF4\u5EA6. Prefer $\\hat{\\beta} = X^{+} y$ over code-style or plain-text math such as beta_hat = pinv(X) @ y or n/d.",
      "Help the reader see the evidence. Whenever a result involves numbers, show the key comparison as a table or figure in observationsMarkdown: prefer figures the experiment code already saved, use a Markdown table for exact values across conditions, and use a fenced checkpoint-chart block containing JSON for a quick bar or line summary when no figure exists. designMarkdown may add a small conditions table titled ### \u8868 N, numbered in sequence with the observations. Never create a PNG solely for checkpoint decoration.",
      "For a reproduction, record paper, README and issue coverage plus every approved or unapproved deviation."
    ],
    parameters: Type.Object({
      title: Type.String({ description: "\u4E00\u53E5\u8BDD\u6982\u62EC\u672C\u8F6E\u6700\u91CD\u8981\u7684\u53D1\u73B0\uFF0C\u4E0D\u52A0 Checkpoint \u6216 C \u7F16\u53F7\u524D\u7F00" }),
      experimentId: Type.Optional(Type.String({ description: "Stable experiment/run identifier when one exists" })),
      answer: Type.String({ description: "\u5BF9\u672C\u8F6E\u95EE\u9898\u7684\u4E00\u53E5\u8BDD\u56DE\u7B54\uFF0C\u4FDD\u5B88\u4E14\u53EF\u88AB\u8BC1\u636E\u652F\u6301" }),
      verdict: StringEnum(["supports", "weakens", "refutes", "inconclusive"], {
        description: "\u672C\u8F6E\u7ED3\u679C\u5BF9\u547D\u9898\u7684\u5F71\u54CD"
      }),
      verdictReason: Type.String({ description: "\u4E00\u53E5\u8BDD\u8BF4\u660E verdict \u7684\u4F9D\u636E" }),
      whyMarkdown: Type.String({ description: "\u4E3A\u4EC0\u4E48\u505A\u8FD9\u4E2A\u5B9E\u9A8C\uFF1A\u6B64\u524D\u8BC1\u636E\u7559\u4E0B\u4E86\u4EC0\u4E48\u672A\u51B3\u95EE\u9898\uFF0C\u672C\u5B9E\u9A8C\u4E3A\u4EC0\u4E48\u80FD\u533A\u5206\u4E0D\u540C\u89E3\u91CA\uFF1B\u4E0D\u8981\u5305\u542B\u4E8C\u7EA7\u6807\u9898" }),
      dataset: Type.Object({
        name: Type.String({ description: "\u6570\u636E\u96C6\u540D\u79F0\u53CA\u7248\u672C\u6216 split\uFF1B\u5408\u6210\u6570\u636E\u5199\u660E\u751F\u6210\u65B9\u5F0F\u7684\u540D\u79F0" }),
        reason: Type.String({ description: "\u4E3A\u4EC0\u4E48\u8FD9\u4E2A\u6570\u636E\u96C6\u9002\u5408\u56DE\u7B54\u672C\u8F6E\u95EE\u9898" }),
        description: Type.String({ description: "\u57FA\u672C\u4FE1\u606F\uFF1A\u6837\u672C\u91CF\u3001\u5212\u5206\u3001\u7279\u5F81\u6216\u8F93\u5165\u3001\u6807\u7B7E\u6216\u76EE\u6807\uFF1B\u5408\u6210\u6570\u636E\u5199\u660E\u751F\u6210\u8FC7\u7A0B\u53CA\u5176\u53C2\u6570" })
      }, { description: "\u672C\u8F6E\u4F7F\u7528\u7684\u6570\u636E\u96C6\uFF1B\u7531\u63D2\u4EF6\u56FA\u5B9A\u663E\u793A\u5728\u5B9E\u9A8C\u8BBE\u8BA1\u5F00\u5934" }),
      keyHyperparameters: Type.Array(
        Type.Object({
          name: Type.String({ description: "\u53C2\u6570\u540D\uFF0C\u6570\u5B66\u91CF\u7528 LaTeX" }),
          value: Type.String({ description: "\u5B9E\u9645\u53D6\u503C\u6216\u626B\u63CF\u8303\u56F4" }),
          reason: Type.String({ description: "\u4E3A\u4EC0\u4E48\u53D6\u8FD9\u4E2A\u503C" })
        }),
        { minItems: 1, maxItems: 12, description: "\u4F1A\u5F71\u54CD\u7ED3\u8BBA\u7684\u5173\u952E\u8D85\u53C2\u6570\uFF0C\u4F8B\u5982\u6837\u672C\u91CF\u3001\u6A21\u578B\u89C4\u6A21\u3001\u6B63\u5219\u5316\u3001\u5B66\u4E60\u7387\u3001\u8BAD\u7EC3\u957F\u5EA6\u548C\u79CD\u5B50\u6570" }
      ),
      designMarkdown: Type.String({ description: "\u8BBE\u8BA1\u601D\u8DEF\uFF1A\u6761\u4EF6\u4E0E\u5BF9\u7167\u3001\u56FA\u5B9A\u4E0D\u53D8\u7684\u91CF\u3001\u6307\u6807\u548C\u5224\u65AD\u89C4\u5219\uFF1B\u6A21\u578B\u3001\u6307\u6807\u548C\u5224\u65AD\u89C4\u5219\u7528 LaTeX \u516C\u5F0F\u5199\u51FA\uFF0C\u6761\u4EF6\u8F83\u591A\u65F6\u53EF\u7528\u6761\u4EF6\u8868\uFF1B\u4E0D\u8981\u590D\u8FF0\u6570\u636E\u96C6\u3001\u8D85\u53C2\u6570\u548C\u4E8B\u5148\u9884\u671F" }),
      observationsMarkdown: Type.String({
        description: "\u5B9E\u9645\u89C2\u5BDF\uFF1A\u53EA\u653E\u56DE\u7B54\u672C\u8F6E\u95EE\u9898\u6240\u9700\u7684\u8BC1\u636E\uFF0C\u6570\u503C\u7ED3\u679C\u4F18\u5148\u7528\u56FE\u6216\u8868\u5C55\u793A\uFF0C\u6570\u5B66\u5173\u7CFB\u7528 LaTeX\uFF08\u884C\u5185 $...$\uFF0C\u72EC\u7ACB $$...$$\uFF09\u3002\u8868\u683C\u4F7F\u7528\u4E0A\u65B9\u4E09\u7EA7\u6807\u9898\u201C### \u8868 N\u3000\u6807\u9898\u201D\uFF1B\u56FE\u7247 caption \u4F7F\u7528\u201C\u56FE N\u3000\u6807\u9898\u201D\u3002\u6BCF\u4E2A\u8868\u683C\u3001\u56FE\u7247\u6216 checkpoint-chart \u540E\u5FC5\u987B\u5355\u72EC\u5199\u89E3\u6790\u6BB5\u843D\u5E76\u6DFB\u52A0 ---\u3002\u56FE\u7247\u76EE\u6807\u4F7F\u7528 artifacts \u4E2D\u7684\u9879\u76EE\u76F8\u5BF9\u8DEF\u5F84\u3002\u8F7B\u91CF\u56FE\u8868\u53EF\u4F7F\u7528 ```checkpoint-chart \u540E\u8DDF JSON\uFF0C\u5176 title \u5FC5\u987B\u662F\u201C\u56FE N\u3000\u6807\u9898\u201D\uFF1Bbar \u683C\u5F0F\u4E3A {type,title,items:[{label,value,color?}]}\uFF0Cline \u683C\u5F0F\u4E3A {type,title,series:[{name,color?,points:[{x,y}]}]}"
      }),
      predictionOutcomes: Type.Array(
        Type.Object({
          outcome: StringEnum(["observed", "partial", "not-observed"]),
          note: Type.String({ description: "\u5224\u65AD\u4F9D\u636E\uFF0C\u5F15\u7528\u5177\u4F53\u6570\u503C\u6216\u56FE\u8868\u7F16\u53F7" })
        }),
        { description: "\u6309\u987A\u5E8F\u9010\u6761\u5224\u65AD\u8FDB\u5165\u5B9E\u9A8C\u65F6\u767B\u8BB0\u7684\u9884\u671F" }
      ),
      judgmentMarkdown: Type.String({ description: "\u5BF9\u7167\u9884\u671F\u7684\u5224\u65AD\uFF1A\u89E3\u91CA\u5224\u65AD\u3001\u610F\u5916\u73B0\u8C61\uFF0C\u4EE5\u53CA\u672C\u7ED3\u679C\u4E0D\u80FD\u8BC1\u660E\u7684\u5185\u5BB9" }),
      newQuestions: Type.Array(
        Type.Object({
          question: Type.String({ description: "\u65B0\u95EE\u9898\uFF0C\u4E00\u53E5\u8BDD" }),
          whyItArose: Type.String({ description: "\u672C\u8F6E\u54EA\u4E2A\u73B0\u8C61\u8BA9\u8FD9\u4E2A\u95EE\u9898\u51FA\u73B0" }),
          proposedExperiment: Type.String({ description: "\u80FD\u56DE\u7B54\u5B83\u7684\u4E0B\u4E00\u4E2A\u5B9E\u9A8C\uFF0C\u5305\u542B\u5173\u952E\u5BF9\u7167" }),
          predictions: Type.Array(PREDICTION, { minItems: 2, maxItems: 4 })
        }),
        { maxItems: 3, description: "\u672C\u8F6E\u7ED3\u679C\u771F\u6B63\u5F15\u51FA\u7684\u65B0\u95EE\u9898\uFF1B\u6CA1\u6709\u65F6\u4F20\u7A7A\u6570\u7EC4" }
      ),
      revisionProposal: Type.Optional(Type.Object({
        statement: Type.String({ description: "\u5EFA\u8BAE\u4FEE\u8BA2\u540E\u7684\u547D\u9898" }),
        reason: Type.String({ description: "\u54EA\u4E9B\u8BC1\u636E\u8981\u6C42\u4FEE\u8BA2" })
      }, { description: "\u4EC5\u5F53\u8BC1\u636E\u8981\u6C42\u6536\u7A84\u6216\u6539\u5199\u547D\u9898\u65F6\u586B\u5199\uFF1B\u7531\u7528\u6237\u51B3\u5B9A\u662F\u5426\u91C7\u7EB3" })),
      protocols: Type.Array(
        Type.Object({
          title: Type.String({ description: "Protocol/run label" }),
          intent: StringEnum(["reproduction", "diagnostic", "exploratory", "ablation"]),
          reference: Type.Optional(Type.String({ description: "Reference protocol, paper, baseline or official run" })),
          dataScope: Type.String({ description: "Actual dataset, split, sample count and sampling scope" }),
          sources: Type.Array(
            Type.Object({
              kind: StringEnum(["paper", "readme", "issue"]),
              status: StringEnum(["consulted", "not-found", "inaccessible"]),
              reference: Type.Optional(Type.String()),
              summary: Type.String({ description: "Guidance, correction, conflict, bug or documented search outcome" })
            }),
            { maxItems: 12 }
          ),
          deviations: Type.Array(
            Type.Object({
              field: Type.String(),
              reference: Type.String(),
              actual: Type.String(),
              reason: Type.String(),
              approvedByUser: Type.Boolean()
            }),
            { maxItems: 12 }
          )
        }),
        { minItems: 1, maxItems: 6 }
      ),
      reproduction: Type.Object({
        model: Type.String({ description: "Model or system name; use not-applicable when appropriate" }),
        modelRevision: Type.String({ description: "Model revision/checkpoint/tag" }),
        dataset: Type.String({ description: "Dataset, environment or task" }),
        dataRevision: Type.String({ description: "Dataset revision/split/version" }),
        codeCommit: Type.String({ description: "Git commit or exact code version" }),
        seeds: Type.Array(Type.String(), { maxItems: 24 }),
        parameters: Type.Array(
          Type.Object({ name: Type.String(), value: Type.String() }),
          { maxItems: 24, description: "Audit-level key parameters" }
        ),
        environment: Type.Optional(Type.String({ description: "GPU/node/runtime when useful" }))
      }),
      artifacts: Type.Optional(
        Type.Array(
          Type.Object({
            path: Type.String({ description: "Project-relative path to a real experiment artifact" }),
            title: Type.String(),
            role: StringEnum(["evidence", "diagnostic", "dataset", "intermediate"]),
            description: Type.String({ description: "One sentence explaining the artifact's research purpose" }),
            takeaway: Type.Optional(Type.String()),
            columns: Type.Optional(Type.Array(Type.String(), { maxItems: 8 }))
          }),
          { maxItems: 16, description: "Real experiment artifacts only; no checkpoint-only decorative images" }
        )
      )
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const chain = await dependencies.prepareChain(params.newQuestions.length, ctx);
      if (typeof chain === "string") return failure(chain);
      let artifacts;
      try {
        artifacts = await prepareCheckpointArtifacts(
          ctx,
          dependencies.getArtifacts(),
          params.artifacts
        );
      } catch (error) {
        return failure(`Checkpoint artifacts could not be prepared: ${String(error)}`);
      }
      const draft = {
        title: params.title,
        experimentId: params.experimentId,
        answer: params.answer,
        verdict: params.verdict,
        verdictReason: params.verdictReason,
        whyMarkdown: params.whyMarkdown,
        dataset: params.dataset,
        keyHyperparameters: params.keyHyperparameters,
        designMarkdown: params.designMarkdown,
        observationsMarkdown: params.observationsMarkdown,
        judgmentMarkdown: params.judgmentMarkdown,
        predictionOutcomes: params.predictionOutcomes,
        newQuestions: params.newQuestions,
        revisionProposal: params.revisionProposal,
        protocols: params.protocols,
        reproduction: params.reproduction
      };
      const validation = validateCheckpointDraft(draft, artifacts, chain.predictions.length);
      if (validation.errors.length) return failure(validation.errors.join("\n"));
      validation.warnings.forEach((warning) => ctx.ui.notify(warning, "warning"));
      let saved;
      try {
        saved = await dependencies.save(draft, artifacts, chain, ctx);
      } catch (error) {
        return failure(`Checkpoint Markdown could not be saved: ${String(error)}`);
      }
      const portForwardCommand = saved.viewerUrl ? formatSshPortForwardCommand(saved.viewerUrl) : void 0;
      dependencies.onReached({ stored: saved.stored, draft, resultCount: artifacts.length }, ctx);
      const details = { draft, chain, artifacts, ...saved, portForwardCommand };
      const newQuestions = draft.newQuestions.map((item, index) => `  ${chain.newQuestionIds[index]} ${item.question}`);
      const lines = [
        `\u2713 C${chain.sequence} answered ${chain.question.id}`,
        `Answer: ${draft.answer}`,
        `Proposition ${chain.proposition.id}: ${VERDICT_LABELS[draft.verdict]}`,
        ...newQuestions.length ? ["New questions:", ...newQuestions] : [],
        "",
        `Saved: ${saved.stored.relativeMarkdownPath}`,
        saved.viewerUrl ? `
Checkpoint:
${saved.viewerUrl}` : void 0,
        portForwardCommand ? `
${portForwardCommand}` : void 0
      ].filter((line) => line !== void 0);
      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details,
        terminate: true
      };
    },
    renderCall(_args, theme) {
      return new Text(theme.fg("toolTitle", theme.bold("Research Checkpoint")), 0, 0);
    },
    renderResult(result, { expanded }, theme) {
      const details = result.details;
      if (!details) return new Text("Research checkpoint reached.", 0, 0);
      return renderCheckpointResult(details, theme, expanded);
    }
  });
}
async function prepareCheckpointArtifacts(ctx, discovered, requested) {
  const prepared = [];
  const projectRoot = resolve6(ctx.cwd);
  const realProjectRoot = await realpath4(projectRoot);
  for (const item of requested ?? []) {
    const requestedPath = item.path.startsWith("@") ? item.path.slice(1) : item.path;
    const requestedAbsolutePath = resolve6(projectRoot, requestedPath);
    if (requestedAbsolutePath !== projectRoot && !requestedAbsolutePath.startsWith(`${projectRoot}${sep5}`)) {
      throw new Error(`Artifact must stay inside the project: ${item.path}`);
    }
    const resolvedRecord = await resolveCheckpointArtifactRecord(ctx.cwd, requestedPath);
    if (!resolvedRecord) throw new Error(`Artifact does not exist or is not a file/dataset: ${item.path}`);
    const absolutePath = resolve6(ctx.cwd, resolvedRecord.path);
    const realArtifactPath = await realpath4(absolutePath);
    if (realArtifactPath !== realProjectRoot && !realArtifactPath.startsWith(`${realProjectRoot}${sep5}`)) {
      throw new Error(`Artifact must stay inside the project: ${item.path}`);
    }
    const artifact = discovered.find((candidate) => resolve6(ctx.cwd, candidate.path) === absolutePath) ?? resolvedRecord;
    prepared.push({ ...item, artifact, absolutePath });
  }
  return prepared;
}
async function resolveCheckpointArtifactRecord(cwd, inputPath) {
  const known = await resolveArtifactRecord(cwd, inputPath);
  if (known) return known;
  const absolutePath = resolve6(cwd, inputPath);
  try {
    const fileStat = await stat5(absolutePath);
    if (!fileStat.isFile()) return void 0;
    return {
      kind: "file",
      path: relative5(cwd, absolutePath).split(sep5).join("/"),
      name: basename4(absolutePath),
      extension: extname5(absolutePath).toLowerCase(),
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      discoveredAt: Date.now()
    };
  } catch {
    return void 0;
  }
}
function renderCheckpointResult(details, theme, expanded) {
  const container = new Container();
  const { chain, draft } = details;
  container.addChild(new Text(theme.fg("success", theme.bold(`\u2713 C${chain.sequence} \xB7 ${chain.proposition.id} / ${chain.question.id}`)), 0, 0));
  container.addChild(new Text(theme.bold(latexToUnicode(draft.title)), 0, 1));
  container.addChild(new Text(`${theme.fg("muted", "\u7B54\u6848")} ${latexToUnicode(draft.answer)}`, 0, 0));
  container.addChild(new Text(`${theme.fg("muted", "\u547D\u9898")} ${VERDICT_LABELS[draft.verdict]}\uFF1A${latexToUnicode(draft.verdictReason)}`, 0, 0));
  draft.newQuestions.forEach((item, index) => {
    container.addChild(new Text(`${theme.fg("accent", chain.newQuestionIds[index] ?? "Q")} ${latexToUnicode(item.question)}`, 0, 0));
  });
  if (expanded) details.artifacts.filter((item) => item.role === "evidence" && checkpointImageMime(item.artifact.extension)).forEach((item) => {
    try {
      const data = readFileSync2(item.absolutePath).toString("base64");
      container.addChild(new Text(`${theme.bold(latexToUnicode(item.title))}
${latexToUnicode(item.description)}`, 0, 1));
      container.addChild(
        createTerminalImage(
          data,
          checkpointImageMime(item.artifact.extension),
          { fallbackColor: (value) => theme.fg("muted", value) },
          { maxWidthCells: 72, maxHeightCells: 24, filename: item.artifact.name, chafaFormat: "sixels" }
        )
      );
    } catch {
    }
  });
  container.addChild(new Text(`${theme.fg("muted", "Saved")} ${details.stored.relativeMarkdownPath}`, 0, 1));
  if (details.viewerUrl) {
    const command = details.portForwardCommand ? `
${details.portForwardCommand}` : "";
    container.addChild(
      new Text(
        `${theme.fg("accent", theme.bold("Checkpoint"))}
${terminalLink(details.viewerUrl, details.viewerUrl)}${command}`,
        0,
        1
      )
    );
  }
  return container;
}
function checkpointImageMime(extension) {
  return {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  }[extension.toLowerCase()];
}
function failure(text) {
  return {
    content: [{ type: "text", text }],
    details: { accepted: false },
    isError: true
  };
}
function terminalLink(url, label) {
  return `\x1B]8;;${url}\x1B\\${label}\x1B]8;;\x1B\\`;
}

// src/core/governor.ts
var EXPLICIT_BROAD_WORK = /\b(?:all tests|full test suite|run (?:the )?entire test|repository[- ]wide|repo[- ]wide|checksum|sha256|exhaustive benchmark)\b|全部测试|完整测试|全量测试|运行.*测试|整个仓库.*(?:测试|格式化)|校验和|完整基准测试/i;
var FULL_TEST_PATTERNS = [
  /^\s*(?:python(?:3)?\s+-m\s+)?pytest(?:\s+-[\w=-]+)*\s*$/i,
  /^\s*(?:npm|pnpm|yarn)\s+(?:test|run\s+test)(?:\s+--?(?:silent|runInBand))?\s*$/i,
  /^\s*cargo\s+test(?:\s+--(?:workspace|all|all-targets))*\s*$/i,
  /^\s*go\s+test\s+\.\/\.\.\.\s*$/i,
  /^\s*(?:tox|nox|make\s+test)\s*$/i
];
var CHECKSUM_PATTERN = /\b(?:sha(?:1|224|256|384|512)sum|md5sum|shasum|certutil\s+-hashfile)\b/i;
var REPO_FORMAT_PATTERN = /\b(?:prettier|eslint|biome)\b[^\n]*(?:--write\s+\.\b|--fix\s+\.\b|\s\.\s*$)|\bcargo\s+fmt\b[^\n]*--all\b/i;
var BROAD_LINT_PATTERN = /^\s*(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:lint|format)\s*$/i;
var REPRO_MANIFEST_PATTERN = /\b(?:pip\s+freeze|conda\s+env\s+export|npm\s+shrinkwrap)\b/i;
var REPRODUCTION_INTENT = /\b(?:please\s+)?(?:reproduce|replicate)\b|\b(?:run|execute)\b.{0,30}\b(?:official experiment|reference protocol|paper result|baseline)\b|(?:请|帮我|开始|继续|重新|运行|执行).{0,20}(?:复现|官方实验|论文实验|基准实验)/i;
var EXPLICIT_DIAGNOSTIC_REJECTION = /\b(?:do not|don't|never|without)\b.{0,30}\b(?:diagnostic|smoke test|small[- ]sample|subset)\b|(?:不要|禁止|不能|不允许).{0,20}(?:小样本|子集|抽样|缩小)/i;
var EXPLICIT_DIAGNOSTIC_AUTHORIZATION = /\b(?:use|run|allow|approve|perform|start with)\b.{0,30}\b(?:diagnostic|smoke test|small[- ]sample|reduced subset|quick subset)\b|(?:允许|可以|先|只用|使用).{0,20}(?:小样本|子集|抽样|\d+\s*(?:条|个)?样本)/i;
var SAMPLE_SCOPE_REDUCTION = /--(?:max[_-]?(?:train[_-]?|eval[_-]?)?samples?|num[_-]?samples?|data[_-]?limit|subset[_-]?size|max[_-]?steps|num[_-]?seeds?|repeats?)\s*(?:=|\s)\s*\d+|\b(?:max[_-]?(?:train[_-]?|eval[_-]?)?samples?|num[_-]?samples?|data[_-]?limit|subset[_-]?size|sample[_-]?count|dataset[_-]?size|max[_-]?steps|num[_-]?seeds?|repeats?)\s*[:=]\s*\d+|\bhead\s+-n\s+\d+[^|\n]*>|\.select\s*\(\s*range\s*\(\s*\d+|\.take\s*\(\s*\d+|\b(?:data|dataset|ds|samples|examples|records|rows|train|test|eval|val|valid|split|seeds)\w*\s*\[\s*:\s*\d+\s*\]/i;
function evaluateResearchFidelity(toolName, input, userPrompt, experiment) {
  if (experiment?.intent !== "reproduction" || !EXPLICIT_DIAGNOSTIC_REJECTION.test(userPrompt) && EXPLICIT_DIAGNOSTIC_AUTHORIZATION.test(userPrompt)) {
    return { block: false };
  }
  if (!/^(?:bash|edit|write)$/.test(toolName)) return { block: false };
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  if (!SAMPLE_SCOPE_REDUCTION.test(serialized)) return { block: false };
  const reason = "This reproduction reduces samples, steps, seeds, or repeats without approval. Tell the user the original and proposed settings, why they would change, and how that affects the result, then obtain explicit approval.";
  return {
    block: true,
    reason,
    approval: {
      kind: "protocol-deviation",
      title: "Approve protocol deviation?",
      message: [
        "Research Loop detected a reduced reproduction scope. Approving allows this exact action, but the run must be reported as diagnostic or as an explicit protocol deviation.",
        "",
        preview(serialized)
      ].join("\n"),
      declineReason: "User declined the reproduction protocol deviation."
    }
  };
}
function evaluateResearchCommand(command, userPrompt) {
  if (EXPLICIT_BROAD_WORK.test(userPrompt)) return { block: false };
  const segments = command.split(/(?:&&|\|\||;|\r?\n)/).map((segment) => segment.trim()).filter(Boolean);
  if (segments.some((segment) => FULL_TEST_PATTERNS.some((pattern) => pattern.test(segment)))) {
    return {
      block: true,
      reason: "Research Loop blocked a repository-wide test run. Use targeted validation tied to the current task."
    };
  }
  if (CHECKSUM_PATTERN.test(command) || REPRO_MANIFEST_PATTERN.test(command)) {
    if (REPRODUCTION_INTENT.test(userPrompt)) return { block: false };
    return {
      block: true,
      reason: "Research Loop blocked bookkeeping that is not needed for the next insight."
    };
  }
  if (REPO_FORMAT_PATTERN.test(command) || BROAD_LINT_PATTERN.test(command)) {
    return {
      block: true,
      reason: "Research Loop blocked repository-wide formatting or linting. Restrict it to the changed surface."
    };
  }
  return { block: false };
}
function preview(value, maximum = 600) {
  const compact = value.trim();
  return compact.length <= maximum ? compact : `${compact.slice(0, maximum)}\u2026`;
}
var MODE_GUIDANCE = {
  brainstorming: "Compare genuinely different options and recommend a direction. Do not edit files or run empirical work in this mode.",
  exploration: "Read only the code and materials relevant to the current objective. Trace the necessary behavior and return the findings directly with useful file references. Switch to Experiment before empirical work."
};
function experimentGuidance(experiment) {
  const details = experiment ? [
    `Title: ${experiment.title}`,
    `Question${experiment.questionId ? ` ${experiment.questionId}` : ""}: ${experiment.question}`,
    ...experiment.rationale ? [`Rationale: ${experiment.rationale}`] : [],
    ...(experiment.predictions ?? []).map((prediction, index) => `Prediction ${index + 1}: if ${prediction.observation}, then ${prediction.implication}`),
    `Intent: ${experiment.intent}`,
    `Planned data: ${experiment.plannedDataScope}`,
    ...experiment.reference ? [`Reference: ${experiment.reference}`] : [],
    ...experiment.artifactRoots?.length ? [`Artifact roots: ${experiment.artifactRoots.join(", ")}`] : []
  ].join("\n") : "";
  const reproduction = experiment?.intent === "reproduction" ? "\nBefore running this reproduction, check the official paper, the matching repository README, and relevant issues. Keep the referenced data, split, preprocessing, model or checkpoint, objective, evaluation, seeds, repeats, and material settings. Ask before changing them; a reduced run is diagnostic rather than a reproduction result." : "";
  return `Run the work needed to answer the experiment question and record what actually happened. Finish with research_checkpoint, or use research_abort_experiment only if no interpretable result was produced.${details ? `
${details}` : ""}${reproduction}`;
}
function researchPolicy(mode, actions, softReview, objective, experiment) {
  const guidance = mode === "experiment" ? experimentGuidance(experiment) : MODE_GUIDANCE[mode];
  const review = mode === "experiment" && softReview ? `[SOFT REVIEW] ${actions} actions have run in this experiment. Before the next action, check whether the evidence already answers the question. If it does, finish with research_checkpoint now so the user can calibrate; otherwise take only the step that most directly answers it.` : void 0;
  return [
    `[RESEARCH LOOP: ${mode.toUpperCase()}]`,
    ...objective ? [`Objective: ${objective}`] : [],
    guidance,
    ...review ? [review] : [],
    "Start with the work or findings. Do not narrate Research Loop or mode changes unless the user needs to make a decision.",
    "Write every mathematical expression as LaTeX, inline $...$ and display $$...$$, in replies and in every research tool field, including propositions, questions, predictions and checkpoint titles and answers. Research Loop renders it in the Viewer and converts it for the terminal."
  ].join("\n");
}

// src/core/research-core.ts
var SOFT_REVIEW_INTERVAL = 6;
var MUTATING_TOOLS = /* @__PURE__ */ new Set(["edit", "write", "multiedit", "notebookedit", "apply_patch"]);
var EMPIRICAL_COMMAND = /(?:^|\s)(?:pytest|tox|nox|cargo\s+(?:run|test|bench)|go\s+test|(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:test|bench|benchmark|train|eval))|python(?:3)?\s+[^\n]*\.py\b|torchrun|deepspeed|accelerate\s+launch|sbatch|qsub)(?:\s|$)/i;
var ResearchCore = class {
  state;
  roundActions = 0;
  nextSoftReviewAt = SOFT_REVIEW_INTERVAL;
  softReviewPending = false;
  softReviewRaisedThisTurn = false;
  checkpointReached = false;
  checkpointResultCount = 0;
  toolCallsThisTurn = 0;
  terminalToolAccepted = false;
  currentUserPrompt = "";
  constructor(initial) {
    this.state = defaultState();
    if (initial && "schemaVersion" in initial) this.restoreSnapshot(initial);
    else if (initial) this.restoreState(initial);
  }
  get enabled() {
    return this.state.enabled;
  }
  get workMode() {
    return this.state.workMode;
  }
  get lifecycleTransitionPending() {
    return this.terminalToolAccepted;
  }
  get propositionId() {
    return this.state.propositionId;
  }
  get experiment() {
    return this.state.experiment ? cloneExperiment(this.state.experiment) : void 0;
  }
  get artifactRoots() {
    return [...this.state.artifactRoots];
  }
  get artifacts() {
    return this.state.artifacts.map((artifact) => ({ ...artifact }));
  }
  get researchState() {
    return cloneState(this.state);
  }
  get controlState() {
    const { artifacts: _artifacts, ...control } = this.state;
    return {
      ...control,
      experiment: control.experiment ? cloneExperiment(control.experiment) : void 0,
      artifactRoots: [...control.artifactRoots]
    };
  }
  setEnabled(enabled) {
    this.state.enabled = enabled;
    this.state.workMode = "exploration";
    this.state.objective = void 0;
    this.state.experiment = void 0;
    this.resetRound();
  }
  setProposition(propositionId) {
    this.state.propositionId = propositionId;
  }
  enterMode(mode, objective, experiment) {
    if (!isWorkMode(mode)) return { block: true, reason: `Unknown Research Work Mode: ${String(mode)}.` };
    if (!this.state.enabled) return { block: true, reason: "Research Loop is off." };
    if (this.state.workMode === "experiment") {
      return {
        block: true,
        reason: "Experiment Mode is already active and must end with research_checkpoint or research_abort_experiment."
      };
    }
    if (mode === "experiment" && !experiment) {
      return { block: true, reason: "Experiment Mode requires a declared experiment plan." };
    }
    if (mode === "experiment" && !this.state.propositionId) {
      return {
        block: true,
        reason: "Experiment Mode requires an active proposition. Agree on the proposition with the user and record it with research_proposition first."
      };
    }
    if (mode === "experiment" && (!experiment.questionId || (experiment.predictions?.length ?? 0) < 2)) {
      return {
        block: true,
        reason: "Experiment Mode requires a questionId from the active proposition and at least two predictions registered before the run."
      };
    }
    this.state.workMode = mode;
    this.state.objective = objective;
    this.state.experiment = mode === "experiment" ? { ...cloneExperiment(experiment), propositionId: this.state.propositionId } : void 0;
    if (mode === "experiment") this.addArtifactRoots(experiment.artifactRoots ?? []);
    this.resetRound();
    return { block: false };
  }
  abortExperiment() {
    if (this.state.workMode !== "experiment") {
      return { block: true, reason: "No Experiment Mode is active." };
    }
    this.state.workMode = "exploration";
    this.state.objective = void 0;
    this.state.experiment = void 0;
    this.resetRound();
    return { block: false };
  }
  reachCheckpoint(resultCount) {
    this.state.workMode = "exploration";
    this.state.objective = void 0;
    this.state.experiment = void 0;
    this.checkpointReached = true;
    this.checkpointResultCount = resultCount;
    this.softReviewPending = false;
  }
  setArtifacts(artifacts) {
    this.state.artifacts = artifacts.map((artifact) => ({ ...artifact }));
  }
  upsertArtifact(artifact) {
    const index = this.state.artifacts.findIndex(
      (candidate) => candidate.kind === artifact.kind && candidate.path === artifact.path
    );
    if (index >= 0) this.state.artifacts[index] = { ...artifact };
    else this.state.artifacts.push({ ...artifact });
  }
  setArtifactRoots(roots, currentExperimentRoots) {
    const normalized = compactArtifactRoots(roots);
    let changed = normalized.length !== this.state.artifactRoots.length || normalized.some((root, index) => root !== this.state.artifactRoots[index]);
    if (changed) this.state.artifactRoots = normalized;
    if (this.state.workMode === "experiment" && this.state.experiment && currentExperimentRoots) {
      const current = compactArtifactRoots(currentExperimentRoots);
      const experimentChanged = current.length !== (this.state.experiment.artifactRoots?.length ?? 0) || current.some((root, index) => root !== this.state.experiment.artifactRoots?.[index]);
      if (experimentChanged) {
        this.state.experiment.artifactRoots = current;
        changed = true;
      }
    }
    return changed;
  }
  addArtifactRoots(roots) {
    const compacted = compactArtifactRoots([...this.state.artifactRoots, ...roots]);
    const stateChanged = compacted.length !== this.state.artifactRoots.length || compacted.some((root, index) => root !== this.state.artifactRoots[index]);
    if (stateChanged) this.state.artifactRoots = compacted;
    let experimentChanged = false;
    if (this.state.workMode === "experiment" && this.state.experiment) {
      const experimentRoots = compactArtifactRoots([
        ...this.state.experiment.artifactRoots ?? [],
        ...roots
      ]);
      experimentChanged = experimentRoots.length !== (this.state.experiment.artifactRoots?.length ?? 0) || experimentRoots.some((root, index) => root !== this.state.experiment.artifactRoots?.[index]);
      if (experimentChanged) this.state.experiment.artifactRoots = experimentRoots;
    }
    return stateChanged || experimentChanged;
  }
  resetRequest(prompt) {
    this.currentUserPrompt = prompt;
    this.resetRound();
  }
  policy() {
    if (!this.state.enabled) return void 0;
    return researchPolicy(
      this.state.workMode,
      this.roundActions,
      this.softReviewPending,
      this.state.objective,
      this.state.experiment
    );
  }
  startTurn() {
    this.toolCallsThisTurn = 0;
    this.terminalToolAccepted = false;
    this.softReviewRaisedThisTurn = false;
  }
  completeLifecycleTransition() {
    this.terminalToolAccepted = false;
  }
  evaluateToolCall(toolName, input) {
    if (!this.state.enabled) return void 0;
    const researchTool = identifyResearchTool(toolName);
    if (researchTool === "research_checkpoint") {
      if (this.state.workMode !== "experiment") {
        return { block: true, reason: "research_checkpoint is available only in Experiment Mode." };
      }
      return this.acceptTerminalTool("research_checkpoint");
    }
    if (researchTool === "research_abort_experiment") {
      if (this.state.workMode !== "experiment") {
        return { block: true, reason: "No Experiment Mode is active." };
      }
      return this.acceptTerminalTool("research_abort_experiment");
    }
    if (researchTool === "research_mode") {
      if (this.state.workMode === "experiment") {
        return {
          block: true,
          reason: "Experiment Mode is already active and must end with research_checkpoint or research_abort_experiment."
        };
      }
      return this.acceptTerminalTool("research_mode");
    }
    if (this.terminalToolAccepted) {
      return {
        block: true,
        reason: "Wait for the research lifecycle transition to complete before running work or dispatching a subagent."
      };
    }
    this.toolCallsThisTurn += 1;
    const normalizedTool = toolName.toLowerCase();
    if ((this.state.workMode === "brainstorming" || this.state.workMode === "exploration") && MUTATING_TOOLS.has(normalizedTool)) {
      return {
        block: true,
        reason: `${displayMode(this.state.workMode)} is read-oriented. Disable Research Loop before editing code, or enter Experiment Mode for empirical work.`
      };
    }
    const command = isShellTool(normalizedTool) ? extractCommand(input) : "";
    if (command && (this.state.workMode === "brainstorming" || this.state.workMode === "exploration") && EMPIRICAL_COMMAND.test(command)) {
      return {
        block: true,
        reason: `${displayMode(this.state.workMode)} cannot run empirical work. Declare an experiment and switch to Experiment Mode first.`
      };
    }
    const fidelity = evaluateResearchFidelity(normalizedTool, input, this.currentUserPrompt, this.state.experiment);
    if (fidelity.block) return fidelity;
    if (command) {
      const decision = evaluateResearchCommand(command, this.currentUserPrompt);
      if (decision.block) return decision;
    }
    this.recordAction();
    return void 0;
  }
  acceptApprovedToolCall() {
    if (this.state.enabled) this.recordAction();
  }
  projectStatus() {
    if (!this.state.enabled) return { text: "RESEARCH OFF", tone: "dim" };
    if (this.checkpointReached) {
      return {
        text: `RESEARCH ON | CHECKPOINT REACHED | RESULTS ${this.checkpointResultCount}`,
        tone: "success"
      };
    }
    const parts = [
      "RESEARCH ON",
      displayMode(this.state.workMode),
      `ACTIONS ${this.roundActions}`,
      this.softReviewPending ? "SOFT REVIEW" : void 0,
      `OUTPUTS ${this.state.artifacts.length}`
    ].filter((part) => Boolean(part));
    return {
      text: parts.join(" | "),
      tone: this.softReviewPending ? "warning" : this.state.workMode === "experiment" ? "success" : "accent"
    };
  }
  snapshot(includeArtifacts = true) {
    return {
      schemaVersion: 1,
      state: includeArtifacts ? cloneState(this.state) : { ...this.controlState, artifacts: [] },
      roundActions: this.roundActions,
      nextSoftReviewAt: this.nextSoftReviewAt,
      softReviewPending: this.softReviewPending,
      checkpointReached: this.checkpointReached,
      checkpointResultCount: this.checkpointResultCount,
      toolCallsThisTurn: this.toolCallsThisTurn,
      terminalToolAccepted: this.terminalToolAccepted,
      currentUserPrompt: this.currentUserPrompt,
      artifactCount: this.state.artifacts.length
    };
  }
  restoreState(state) {
    const restoredMode = isWorkMode(state.workMode) ? state.workMode : "exploration";
    const mode = restoredMode === "experiment" && !state.experiment ? "exploration" : restoredMode;
    this.state = {
      enabled: state.enabled ?? false,
      workMode: mode,
      propositionId: typeof state.propositionId === "string" ? state.propositionId : void 0,
      objective: state.objective,
      experiment: mode === "experiment" && state.experiment ? cloneExperiment(state.experiment) : void 0,
      artifactRoots: compactArtifactRoots(Array.isArray(state.artifactRoots) ? state.artifactRoots : []),
      artifacts: Array.isArray(state.artifacts) ? state.artifacts.map((artifact) => ({ ...artifact })) : []
    };
    this.resetRound();
  }
  restoreSnapshot(snapshot) {
    this.restoreState(snapshot.state);
    this.roundActions = nonNegativeInteger(snapshot.roundActions, 0);
    this.nextSoftReviewAt = Math.max(
      SOFT_REVIEW_INTERVAL,
      nonNegativeInteger(snapshot.nextSoftReviewAt, SOFT_REVIEW_INTERVAL)
    );
    this.softReviewPending = snapshot.softReviewPending === true;
    this.checkpointReached = snapshot.checkpointReached === true;
    this.checkpointResultCount = nonNegativeInteger(snapshot.checkpointResultCount, 0);
    this.toolCallsThisTurn = nonNegativeInteger(snapshot.toolCallsThisTurn, 0);
    this.terminalToolAccepted = snapshot.terminalToolAccepted === true;
    this.currentUserPrompt = typeof snapshot.currentUserPrompt === "string" ? snapshot.currentUserPrompt : "";
  }
  acceptTerminalTool(toolName) {
    if (this.terminalToolAccepted) {
      return {
        block: true,
        reason: `${toolName} cannot start while another research lifecycle transition is pending.`
      };
    }
    this.terminalToolAccepted = true;
    this.toolCallsThisTurn += 1;
    return void 0;
  }
  recordAction() {
    if (this.state.workMode === "experiment" && this.softReviewPending && !this.softReviewRaisedThisTurn) {
      this.softReviewPending = false;
      while (this.nextSoftReviewAt <= this.roundActions) {
        this.nextSoftReviewAt += SOFT_REVIEW_INTERVAL;
      }
    }
    this.roundActions += 1;
    if (this.state.workMode === "experiment" && this.roundActions >= this.nextSoftReviewAt) {
      this.softReviewPending = true;
      this.softReviewRaisedThisTurn = true;
    }
  }
  resetRound() {
    this.roundActions = 0;
    this.nextSoftReviewAt = SOFT_REVIEW_INTERVAL;
    this.softReviewPending = false;
    this.softReviewRaisedThisTurn = false;
    this.checkpointReached = false;
    this.checkpointResultCount = 0;
  }
};
function isWorkMode(value) {
  return value === "brainstorming" || value === "exploration" || value === "experiment";
}
function displayMode(mode) {
  return mode.toUpperCase();
}
function identifyResearchTool(toolName) {
  return ["research_mode", "research_checkpoint", "research_abort_experiment"].find((name) => toolName === name);
}
function isShellTool(toolName) {
  return toolName === "bash" || toolName === "shell" || toolName === "exec";
}
function extractCommand(input) {
  if (!input || typeof input !== "object") return "";
  const command = input.command;
  return typeof command === "string" ? command : "";
}
function defaultState() {
  return { enabled: false, workMode: "exploration", artifactRoots: [], artifacts: [] };
}
function cloneState(state) {
  return {
    ...state,
    experiment: state.experiment ? cloneExperiment(state.experiment) : void 0,
    artifactRoots: [...state.artifactRoots],
    artifacts: state.artifacts.map((artifact) => ({ ...artifact }))
  };
}
function cloneExperiment(experiment) {
  return {
    ...experiment,
    predictions: experiment.predictions?.map((prediction) => ({ ...prediction })),
    artifactRoots: experiment.artifactRoots ? [...experiment.artifactRoots] : void 0
  };
}
function compactArtifactRoots(roots) {
  const normalized = [...new Set(roots.filter((root) => typeof root === "string").map((root) => root.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "")).filter((root) => Boolean(root) && root !== ".." && !root.startsWith("../") && !root.startsWith("/") && !/^[A-Za-z]:\//.test(root)))].sort((a, b2) => a.length - b2.length || a.localeCompare(b2));
  const compacted = [];
  for (const root of normalized) {
    if (compacted.some((parent) => root === parent || root.startsWith(`${parent}/`))) continue;
    compacted.push(root);
  }
  return compacted;
}
function nonNegativeInteger(value, fallback) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

// src/pi-status.ts
function renderPiResearchStatus(snapshot, theme, userDecisionPending = false, nextQuestionId) {
  const projection = projectPiStatus(snapshot, userDecisionPending, nextQuestionId);
  const marker = theme.fg(projection.tone, projection.marker);
  const research = theme.fg(projection.enabled ? "accent" : "dim", "research");
  const mode = theme.fg(projection.tone, projection.mode);
  const details = projection.details.map((detail) => `${theme.fg("dim", " \xB7 ")}${theme.fg("text", detail)}`).join("");
  return `${marker} ${research}  ${mode}${details}`;
}
function projectPiStatus(snapshot, userDecisionPending = false, nextQuestionId) {
  if (!snapshot.state.enabled) {
    return { marker: "\u25C7", mode: "off", details: [], tone: "dim", enabled: false };
  }
  if (snapshot.checkpointReached) {
    return {
      marker: "\u25C6",
      mode: "checkpoint",
      details: [count(snapshot.checkpointResultCount, "result")],
      tone: "success",
      enabled: true
    };
  }
  const mode = snapshot.state.workMode;
  const projection = {
    marker: mode === "experiment" ? "\u25C6" : "\u25C7",
    mode,
    details: [...propositionDetails(snapshot, nextQuestionId), ...modeDetails(snapshot)],
    tone: modeTone(mode),
    enabled: true
  };
  if (snapshot.softReviewPending) {
    projection.tone = "warning";
    projection.details.push("review due");
  }
  if (userDecisionPending) {
    projection.tone = "warning";
    projection.details.push("waiting for decision");
  }
  return projection;
}
function propositionDetails(snapshot, nextQuestionId) {
  const propositionId = snapshot.state.propositionId;
  if (!propositionId) return snapshot.state.enabled ? ["no proposition"] : [];
  const questionId = snapshot.state.workMode === "experiment" ? snapshot.state.experiment?.questionId : nextQuestionId && `next ${nextQuestionId}`;
  return [questionId ? `${propositionId} ${questionId}` : propositionId];
}
function modeDetails(snapshot) {
  switch (snapshot.state.workMode) {
    case "brainstorming":
      return ["read only"];
    case "exploration":
      return ["read only"];
    case "experiment":
      return [
        snapshot.state.experiment?.intent.replace(/-/g, " ") ?? "experiment",
        count(snapshot.roundActions, "action"),
        count(snapshot.artifactCount ?? snapshot.state.artifacts.length, "output")
      ];
  }
}
function modeTone(mode) {
  return {
    brainstorming: "warning",
    exploration: "accent",
    experiment: "success"
  }[mode];
}
function count(value, noun) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

// src/runtime.ts
var STATE_ENTRY = "research-loop-state";
var POLICY_MESSAGE = "research-loop-policy";
var RESEARCH_TOOLS = ["research_mode", "research_proposition", "research_checkpoint", "research_abort_experiment"];
var ASK_USER_QUESTION_TOOL = "ask_user_question";
var STRUCTURED_DECISION_GUIDANCE = [
  "[RESEARCH DECISIONS]",
  "ask_user_question is available. Use it once, grouping related questions, when research cannot proceed without a concrete user decision.",
  "Use it for scientifically material protocol or scope choices, cost/scope trade-offs between alternatives, and branches between genuinely different next experiments.",
  "Do not ask the user to choose the next question before a checkpoint: list the questions the result raised in research_checkpoint newQuestions, and Research Loop presents them to the user. Do not ask about routine, reversible choices or repeat an answered question.",
  "Governor approval dialogs authorize one exact action. If the user declines, stop and do not retry that action."
].join("\n");
var PI_EXPERIMENT_CODE_GUIDANCE = [
  "[EXPERIMENT CODE]",
  "When creating or revising experiment code, optimize for a researcher's reading, running, debugging, modification, and inspection loop. Prefer readable, runnable, observable, modifiable code over production-style architecture.",
  "Make the top-level main() mirror the natural experiment phases so the full workflow is understandable without opening every helper. Functions should represent natural experimental actions or clear responsibilities; keep simple contiguous logic together.",
  "Python experiment scripts must use Rich with a restrained hierarchy for the startup configuration summary, major phase boundaries, scientifically useful intermediate checks, condition/metric tables, the final result summary, and explicit artifact paths. Declare Rich and tqdm in the project's existing dependency surface and do not build fallback logging UI. Do not log every function, batch, sample, tensor shape, or internal state.",
  "Use tqdm for repeated work that makes the researcher wait: dataset processing, batched inference, activation extraction, layer scans, seed sweeps, or large evaluation. Avoid progress bars for millisecond loops and avoid deeply nested bars.",
  "Centralize every research-significant parameter in one obvious config/CLI surface: model, dataset, layers, seeds, batch size, split, thresholds, run count, and output directory. Use descriptive names and remove unexplained magic numbers.",
  "Keep the normal entry point direct, preferably `python experiment.py`; provide clear --help. For costly runs, add a small --quick or --smoke path that exercises the whole pipeline. Show every reduced setting and treat a reduced reproduction run as diagnostic unless the user approved the deviation.",
  "After each major phase, print only checks that help detect a scientifically meaningful problem, such as sample counts, activation shape, label balance/correlation, or condition summaries. Fail early with a concrete actionable error when a missing input or incompatible setting would otherwise waste a long run.",
  "Make randomness explicit: identify which seed controls splits, pseudo-labels, initialization, and sampling. Never silently change seeds, devices, models, environment variables, output locations, or experimental conditions, and never silently fall back.",
  "Use names that express research meaning. Comments should explain why a split, metric, layer, control, fixed variable, or protocol deviation exists; do not translate obvious code into comments.",
  "Separate model loading, data preparation, conditions, analysis, and plotting only when they are naturally distinct. Avoid factories, registries, strategy/context hierarchies, tiny wrapper chains, and reusable frameworks until multiple real experiments need them.",
  "Avoid broad defensive layers, retries, compatibility shims, silent recovery, repeated existence checks, and large try/except shells. Add only checks that prevent expensive wasted work or misleading results.",
  "Save scientific artifacts once under a stable predictable run directory and declare project-relative output directories in research_mode artifactRoots; Artifact Radar stays disabled when roots are omitted. Use names such as summary.json, per_seed.csv, per_layer.csv, figures/, predictions, activations, or checkpoints. Do not copy artifacts for checkpoint presentation and do not create display-only files.",
  "For each main comparison the experiment is meant to answer, save one clearly labeled figure under the run's figures/ directory, with axis labels and units, a legend, and the compared conditions, so the checkpoint can show the evidence directly. Save the exact per-condition values as CSV alongside it.",
  "End the run with a compact Rich result table and a labeled list of exact saved paths so the researcher can judge the result and start the next iteration immediately."
].join("\n");
function shouldAbortForCancelledQuestionnaire(toolName, details) {
  if (toolName !== ASK_USER_QUESTION_TOOL || !details || typeof details !== "object") return false;
  const result = details;
  return result.cancelled === true && result.error === void 0;
}
var ResearchRuntime = class {
  constructor(pi) {
    this.pi = pi;
  }
  core = new ResearchCore();
  blockedToolAttempts = /* @__PURE__ */ new Map();
  userDecisionPending = false;
  propositionContext;
  nextQuestionId;
  get propositionId() {
    return this.core.propositionId;
  }
  get selectedNextQuestionId() {
    return this.nextQuestionId;
  }
  get enabled() {
    return this.core.enabled;
  }
  get workMode() {
    return this.core.workMode;
  }
  get experiment() {
    return this.core.experiment;
  }
  get artifacts() {
    return this.core.artifacts;
  }
  get artifactRoots() {
    return this.core.artifactRoots;
  }
  get currentArtifactRoots() {
    return this.core.experiment?.artifactRoots ?? [];
  }
  startSession(ctx) {
    this.blockedToolAttempts.clear();
    this.userDecisionPending = false;
    this.propositionContext = void 0;
    this.nextQuestionId = void 0;
    const latest = findLatestResearchState(ctx);
    const embeddedArtifacts = Boolean(latest && Object.hasOwn(latest, "artifacts"));
    const legacyArtifacts = embeddedArtifacts && Array.isArray(latest?.artifacts) ? latest.artifacts : [];
    const { artifacts: _artifacts, ...controlState } = latest ?? {};
    this.core.restoreState(controlState);
    this.setToolAvailability();
    this.renderStatus(ctx);
    return { embeddedArtifacts, legacyArtifacts };
  }
  setEnabled(enabled, ctx) {
    this.blockedToolAttempts.clear();
    this.core.setEnabled(enabled);
    this.setToolAvailability();
    this.persist();
    this.renderStatus(ctx);
    ctx.ui.notify(`Research Loop: ${enabled ? "ON" : "OFF"}`, "info");
  }
  /** Activate a proposition; its summary is injected through setPropositionContext. */
  setProposition(propositionId, ctx) {
    if (this.core.propositionId === propositionId) return;
    this.core.setProposition(propositionId);
    this.nextQuestionId = void 0;
    this.persist();
    this.renderStatus(ctx);
  }
  setPropositionContext(context) {
    this.propositionContext = context;
  }
  selectNextQuestion(questionId, ctx) {
    this.nextQuestionId = questionId;
    this.renderStatus(ctx);
  }
  enterMode(mode, objective, experiment, ctx) {
    const decision = this.core.enterMode(mode, objective, experiment);
    if (decision.block) return decision;
    if (mode === "experiment") this.nextQuestionId = void 0;
    this.blockedToolAttempts.clear();
    this.setToolAvailability();
    this.persist();
    this.renderStatus(ctx);
    return decision;
  }
  abortExperiment(reason, ctx) {
    const decision = this.core.abortExperiment();
    if (decision.block) return decision;
    this.blockedToolAttempts.clear();
    this.setToolAvailability();
    this.persist();
    this.renderStatus(ctx);
    ctx.ui.notify(`Experiment aborted: ${reason}`, "warning");
    return decision;
  }
  setArtifacts(artifacts, ctx) {
    this.core.setArtifacts(artifacts);
    if (ctx) this.renderStatus(ctx);
  }
  upsertArtifact(artifact, ctx) {
    this.core.upsertArtifact(artifact);
    if (ctx) this.renderStatus(ctx);
  }
  setArtifactRoots(roots, currentExperimentRoots, persist = true) {
    const changed = this.core.setArtifactRoots(roots, currentExperimentRoots);
    if (changed && persist) this.persist();
    return changed;
  }
  addArtifactRoots(roots, ctx, persist = true) {
    const changed = this.core.addArtifactRoots(roots);
    if (!changed) return false;
    if (persist) this.persist();
    if (ctx) this.renderStatus(ctx);
    return true;
  }
  persistControlState() {
    this.persist();
  }
  resetRequest(prompt, ctx) {
    this.blockedToolAttempts.clear();
    this.core.resetRequest(prompt);
    this.renderStatus(ctx);
  }
  policy() {
    const policy = this.core.policy();
    if (!policy) return void 0;
    const guidance = [policy];
    if (this.propositionContext) guidance.push(this.propositionContext);
    if (this.core.workMode === "experiment") guidance.push(PI_EXPERIMENT_CODE_GUIDANCE);
    if (this.pi.getActiveTools().includes(ASK_USER_QUESTION_TOOL)) guidance.push(STRUCTURED_DECISION_GUIDANCE);
    return guidance.join("\n");
  }
  startTurn() {
    this.core.startTurn();
  }
  setUserDecisionPending(pending, ctx) {
    this.userDecisionPending = pending;
    this.renderStatus(ctx);
  }
  async evaluateToolCall(toolName, input, ctx) {
    const decision = this.core.evaluateToolCall(toolName, input);
    if (!decision?.approval) {
      if (decision?.block) {
        const fingerprint = toolFingerprint(toolName, input);
        const attempts = (this.blockedToolAttempts.get(fingerprint) ?? 0) + 1;
        this.blockedToolAttempts.set(fingerprint, attempts);
        if (attempts > 1) {
          ctx.abort();
          this.renderStatus(ctx);
          return {
            block: true,
            reason: `${decision.reason ?? "Research Loop blocked this action."} The unchanged blocked action was repeated, so the current turn was stopped and control returned to the user.`
          };
        }
        this.renderStatus(ctx);
        return {
          ...decision,
          reason: `${decision.reason ?? "Research Loop blocked this action."} Do not retry the unchanged tool call.`
        };
      }
      this.renderStatus(ctx);
      return decision;
    }
    if (!ctx.hasUI) {
      ctx.abort();
      this.renderStatus(ctx);
      return {
        block: true,
        reason: `${decision.reason ?? decision.approval.message} No interactive approval UI is available; the current turn was stopped. Do not retry this action.`
      };
    }
    let approved = false;
    this.setUserDecisionPending(true, ctx);
    try {
      approved = await ctx.ui.confirm(decision.approval.title, decision.approval.message);
    } catch {
    } finally {
      this.userDecisionPending = false;
    }
    if (approved) {
      this.core.acceptApprovedToolCall();
      this.renderStatus(ctx);
      return void 0;
    }
    ctx.abort();
    this.renderStatus(ctx);
    return {
      block: true,
      reason: `${decision.approval.declineReason} The current turn was stopped. Do not retry this action unless the user requests it again.`
    };
  }
  reachCheckpoint(resultCount, ctx) {
    this.blockedToolAttempts.clear();
    this.core.reachCheckpoint(resultCount);
    this.setToolAvailability();
    this.persist();
    this.renderStatus(ctx);
  }
  renderStatus(ctx) {
    ctx.ui.setWidget("research-loop-status", void 0);
    ctx.ui.setStatus(
      "research-loop",
      renderPiResearchStatus(this.core.snapshot(false), ctx.ui.theme, this.userDecisionPending, this.nextQuestionId)
    );
  }
  clearStatus(ctx) {
    this.userDecisionPending = false;
    ctx.ui.setWidget("research-loop-status", void 0);
    ctx.ui.setStatus("research-loop", void 0);
  }
  persist() {
    this.pi.appendEntry(STATE_ENTRY, this.core.controlState);
  }
  setToolAvailability() {
    const active = this.pi.getActiveTools().filter((name) => !RESEARCH_TOOLS.includes(name));
    if (!this.core.enabled) {
      this.pi.setActiveTools(active);
      return;
    }
    active.push("research_mode");
    if (this.core.workMode === "experiment") {
      active.push("research_checkpoint", "research_abort_experiment");
    } else {
      active.push("research_proposition");
    }
    this.pi.setActiveTools(active);
  }
};
function findLatestResearchState(ctx) {
  let entry = ctx.sessionManager.getLeafEntry();
  while (entry) {
    if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
      return entry.data && typeof entry.data === "object" ? entry.data : void 0;
    }
    entry = entry.parentId ? ctx.sessionManager.getEntry(entry.parentId) : void 0;
  }
  return void 0;
}
function toolFingerprint(toolName, input) {
  let serialized;
  try {
    serialized = JSON.stringify(input) ?? String(input);
  } catch {
    serialized = String(input);
  }
  return `${toolName.toLowerCase()}
${serialized}`;
}

// src/index.ts
var ASK_USER_BLOCKED_EVENT = "rpiv:ask-user:blocked";
var PREDICTION2 = Type2.Object({
  observation: Type2.String({ description: "If this is observed (concrete, ideally with a direction or threshold)" }),
  implication: Type2.String({ description: "then it means this for the question or proposition" })
});
function resultText(result) {
  return result.content.map((part) => part.type === "text" ? part.text ?? "" : "").join("\n");
}
function researchLoop(pi) {
  const runtime = new ResearchRuntime(pi);
  let checkpointStore;
  let propositionStore;
  let pendingHandoff;
  let checkpointServer;
  let radar;
  let activeContext;
  let viewerExposureWarned = false;
  let loadedArtifactRoots = /* @__PURE__ */ new Set();
  let artifactLoadTask;
  let artifactAbortController;
  let sessionGeneration = 0;
  let radarRoots = "";
  let artifactRootsDirty = false;
  let artifactRootPersistTimer;
  const getArtifacts = () => {
    const merged = /* @__PURE__ */ new Map();
    for (const artifact of [...runtime.artifacts, ...radar?.getArtifacts() ?? []]) {
      merged.set(`${artifact.kind}:${artifact.path}`, artifact);
    }
    return [...merged.values()].sort((a, b2) => a.discoveredAt - b2.discoveredAt);
  };
  const mergeArtifacts = (records, ctx) => {
    const merged = /* @__PURE__ */ new Map();
    for (const artifact of [...records, ...runtime.artifacts]) {
      merged.set(`${artifact.kind}:${artifact.path}`, artifact);
    }
    runtime.setArtifacts([...merged.values()], ctx);
  };
  const isCurrentSession = (ctx, generation, signal) => generation === sessionGeneration && activeContext === ctx && !signal.aborted;
  const ensureArtifactInventory = async (ctx, requestedRoots = runtime.artifactRoots, generation = sessionGeneration, signal = artifactAbortController?.signal) => {
    if (!signal || !isCurrentSession(ctx, generation, signal)) return;
    if (artifactLoadTask?.generation === generation) await artifactLoadTask.promise;
    if (!isCurrentSession(ctx, generation, signal)) return;
    const pendingRoots = requestedRoots.filter((root) => !loadedArtifactRoots.has(root));
    if (pendingRoots.length === 0) return;
    const promise = (async () => {
      const discovered = await discoverArtifactsFromRoots(ctx.cwd, pendingRoots, signal);
      if (!isCurrentSession(ctx, generation, signal)) return;
      for (const root of pendingRoots) loadedArtifactRoots.add(root);
      mergeArtifacts(discovered, ctx);
    })();
    const task = { generation, promise };
    artifactLoadTask = task;
    try {
      await promise;
    } catch (error) {
      if (isCurrentSession(ctx, generation, signal)) {
        ctx.ui.notify(`Could not rediscover research artifacts: ${String(error)}`, "warning");
      }
    } finally {
      if (artifactLoadTask === task) artifactLoadTask = void 0;
    }
  };
  const flushArtifactRoots = () => {
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = void 0;
    if (!artifactRootsDirty) return;
    artifactRootsDirty = false;
    runtime.persistControlState();
  };
  const scheduleArtifactRoots = () => {
    artifactRootsDirty = true;
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    const generation = sessionGeneration;
    artifactRootPersistTimer = setTimeout(() => {
      if (generation === sessionGeneration) flushArtifactRoots();
    }, 1e3);
  };
  const markArtifactRootsPersisted = () => {
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = void 0;
    artifactRootsDirty = false;
  };
  const stopRadar = () => {
    radar?.stop();
    radar = void 0;
    radarRoots = "";
    flushArtifactRoots();
  };
  const syncRadar = async (ctx, generation = sessionGeneration, signal = artifactAbortController?.signal) => {
    if (!signal || !isCurrentSession(ctx, generation, signal)) return;
    if (!runtime.enabled || runtime.workMode !== "experiment") {
      stopRadar();
      return;
    }
    const normalizeRoots = createArtifactRootNormalizer(ctx.cwd);
    const roots = normalizeRoots(runtime.currentArtifactRoots);
    if (roots.length === 0) {
      stopRadar();
      return;
    }
    await ensureArtifactInventory(ctx, roots, generation, signal);
    if (!isCurrentSession(ctx, generation, signal) || !runtime.enabled || runtime.workMode !== "experiment") return;
    const currentRoots = normalizeRoots(runtime.currentArtifactRoots);
    const signature = JSON.stringify(currentRoots);
    if (signature !== JSON.stringify(roots)) {
      await syncRadar(ctx, generation, signal);
      return;
    }
    if (radar && radarRoots === signature) return;
    stopRadar();
    if (!isCurrentSession(ctx, generation, signal)) return;
    radar = new ArtifactRadar(ctx.cwd, runtime.artifacts, (artifact, isNew) => {
      if (!isCurrentSession(ctx, generation, signal)) return;
      runtime.upsertArtifact(artifact, ctx);
      const inferredRoot = normalizeRoots([inferArtifactRoot(artifact)]);
      if (runtime.addArtifactRoots(inferredRoot, ctx, false)) scheduleArtifactRoots();
      const summary = artifact.kind === "dataset" ? `${artifact.fileCount ?? 0} ${artifact.extension.slice(1).toUpperCase()} files` : formatSize(artifact.size);
      ctx.ui.notify(
        `${isNew ? "Indexed" : "Updated"} ${artifact.kind}: ${artifact.path} (${summary})`,
        "info"
      );
    }, currentRoots);
    radarRoots = signature;
    try {
      radar.start();
    } catch (error) {
      stopRadar();
      if (isCurrentSession(ctx, generation, signal)) {
        ctx.ui.notify(`Artifact Radar unavailable: ${String(error)}`, "warning");
      }
    }
  };
  const warnViewerExposure = (server, ctx) => {
    if (!server.exposedToNetwork || viewerExposureWarned) return;
    viewerExposureWarned = true;
    ctx.ui.notify(
      "Checkpoint Viewer is listening on 0.0.0.0 without authentication. Use this only on a trusted network; SSH forwarding with 127.0.0.1 remains the safer default.",
      "warning"
    );
  };
  const stores = (ctx) => {
    checkpointStore ??= new CheckpointStore(ctx.cwd);
    propositionStore ??= new PropositionStore(checkpointStore);
    return { checkpoints: checkpointStore, propositions: propositionStore };
  };
  const refreshPropositionContext = async (ctx) => {
    const propositionId = runtime.propositionId;
    const tree = propositionId ? await stores(ctx).propositions.tree(propositionId) : void 0;
    runtime.setPropositionContext(describePropositionForPolicy(tree, runtime.selectedNextQuestionId));
  };
  const activateLatestProposition = async (ctx) => {
    if (!runtime.propositionId) {
      const latest = await stores(ctx).propositions.latest();
      if (latest) {
        runtime.setProposition(latest.id, ctx);
        ctx.ui.notify(`Research proposition ${latest.id}: ${latexToUnicode(latest.statement)}`, "info");
      }
    }
    await refreshPropositionContext(ctx);
  };
  const resolveExperiment = async (params, ctx) => {
    const missing = ["title", "questionId", "rationale", "intent", "plannedDataScope"].filter((field) => !params[field]?.trim());
    if ((params.predictions?.length ?? 0) < 2) missing.push("predictions (at least 2)");
    if (missing.length) return `Experiment Mode requires: ${missing.join(", ")}.`;
    const propositionId = runtime.propositionId;
    if (!propositionId) {
      return "Experiment Mode requires an active proposition. Agree on it with the user and record it with research_proposition action=create first.";
    }
    const tree = await stores(ctx).propositions.tree(propositionId);
    if (!tree) return `Active proposition ${propositionId} was not found under checkpoints/propositions.`;
    const question = tree.questions.find((item) => item.id === params.questionId.trim());
    if (!question) {
      const open3 = tree.questions.filter((item) => item.status === "open").map((item) => item.id);
      return `${params.questionId} is not registered under ${propositionId}. Open questions: ${open3.join(", ") || "none"}. Register a new question with research_proposition action=add_question first.`;
    }
    return {
      title: params.title,
      propositionId,
      questionId: question.id,
      question: question.question,
      rationale: params.rationale,
      predictions: params.predictions,
      intent: params.intent,
      plannedDataScope: params.plannedDataScope,
      reference: params.reference,
      artifactRoots: normalizeArtifactRoots(ctx.cwd, params.artifactRoots ?? [])
    };
  };
  const runHandoff = async (handoff, ctx) => {
    const { propositions } = stores(ctx);
    let revision = handoff.revisionProposal;
    const chooseQuestion = async (statement, question) => {
      runtime.selectNextQuestion(question.id, ctx);
      await refreshPropositionContext(ctx);
      const prefill = [
        `\u7EE7\u7EED\u9A8C\u8BC1\u547D\u9898 ${handoff.propositionId}\uFF1A${statement}`,
        `\u4E0B\u4E00\u6B65\u95EE\u9898 ${question.id}\uFF1A${question.question}`,
        question.proposed_experiment ? `\u5EFA\u8BAE\u5B9E\u9A8C\uFF1A${question.proposed_experiment}` : void 0,
        "\u8BF7\u636E\u6B64\u8BBE\u8BA1\u5B9E\u9A8C\uFF0C\u767B\u8BB0\u4E8B\u5148\u9884\u671F\u540E\u8FDB\u5165 Experiment Mode\u3002"
      ].filter((line) => Boolean(line)).join("\n");
      const message = await ctx.ui.editor("\u4E0B\u4E00\u8F6E\u6307\u4EE4\uFF08\u53EF\u4FEE\u6539\u540E\u63D0\u4EA4\uFF1B\u53D6\u6D88\u5219\u53EA\u8BB0\u5F55\u9009\u62E9\uFF09", prefill);
      if (message?.trim() && handoff.generation === sessionGeneration) pi.sendUserMessage(message.trim());
    };
    while (handoff.generation === sessionGeneration) {
      const tree = await propositions.tree(handoff.propositionId);
      if (!tree) return;
      const raised = new Set(handoff.newQuestionIds);
      const open3 = tree.questions.filter((item) => item.status === "open");
      const ordered = [...open3.filter((item) => raised.has(item.id)), ...open3.filter((item) => !raised.has(item.id))];
      const choices = /* @__PURE__ */ new Map();
      ordered.forEach((question) => {
        choices.set(`${question.id}\u3000${latexToUnicode(question.question)}${raised.has(question.id) ? "\uFF08\u672C\u8F6E\u65B0\u95EE\u9898\uFF09" : ""}`, async () => {
          await chooseQuestion(tree.proposition.statement, question);
          return true;
        });
      });
      const proposed = revision;
      if (proposed) {
        choices.set(`\u91C7\u7EB3\u547D\u9898\u4FEE\u8BA2\uFF1A${latexToUnicode(proposed.statement)}`, async () => {
          const approved = await ctx.ui.confirm(
            `\u4FEE\u8BA2\u547D\u9898 ${tree.proposition.id}\uFF1F`,
            latexToUnicode(`\u539F\u547D\u9898\uFF1A${tree.proposition.statement}
\u4FEE\u8BA2\u4E3A\uFF1A${proposed.statement}
\u7406\u7531\uFF1A${proposed.reason}`)
          );
          if (approved) {
            await propositions.revise(tree.proposition.id, proposed.statement, proposed.reason);
            await refreshPropositionContext(ctx);
            ctx.ui.notify(`\u547D\u9898 ${tree.proposition.id} \u5DF2\u4FEE\u8BA2\u3002`, "info");
          }
          revision = void 0;
          return false;
        });
      }
      choices.set("\u63D0\u51FA\u65B0\u7684\u95EE\u9898\u2026", async () => {
        const text = await ctx.ui.input("\u65B0\u95EE\u9898", "\u4E00\u53E5\u8BDD\u63CF\u8FF0\u4E0B\u4E00\u6B65\u8981\u9A8C\u8BC1\u7684\u95EE\u9898");
        if (!text?.trim()) return false;
        const question = await propositions.addQuestion(
          tree.proposition.id,
          text,
          `\u7528\u6237\u5728 C${handoff.sequence} \u4E4B\u540E\u63D0\u51FA\u3002`,
          "user"
        );
        await chooseQuestion(tree.proposition.statement, question);
        return true;
      });
      choices.set("\u6682\u4E0D\u51B3\u5B9A", async () => true);
      const picked = await ctx.ui.select(
        `C${handoff.sequence} \u5DF2\u5B8C\u6210 \xB7 \u547D\u9898 ${tree.proposition.id}\uFF1A\u4E0B\u4E00\u6B65\u9A8C\u8BC1\u54EA\u4E2A\u95EE\u9898\uFF1F`,
        [...choices.keys()]
      );
      if (!picked || await choices.get(picked)()) return;
    }
  };
  const startCheckpointViewer = async (ctx) => {
    checkpointStore ??= new CheckpointStore(ctx.cwd);
    checkpointServer ??= new CheckpointViewerServer(checkpointStore);
    await checkpointServer.start();
    warnViewerExposure(checkpointServer, ctx);
    return checkpointServer;
  };
  registerResearchCheckpoint(pi, {
    getArtifacts,
    async prepareChain(newQuestionCount, ctx) {
      const experiment = runtime.experiment;
      if (!experiment?.propositionId || !experiment.questionId || !experiment.predictions?.length) {
        return "This experiment was started without a proposition question, so it cannot be linked into a checkpoint chain. Ask the user to end it with /research off and restart it under a proposition.";
      }
      const tree = await stores(ctx).propositions.tree(experiment.propositionId);
      if (!tree) return `Proposition ${experiment.propositionId} was not found under checkpoints/propositions.`;
      const question = tree.questions.find((item) => item.id === experiment.questionId);
      if (!question) return `Question ${experiment.questionId} is no longer registered under ${experiment.propositionId}.`;
      const raisedBy = tree.checkpoints.find((checkpoint) => checkpoint.id === question.raised_by);
      const firstQuestion = nextQuestionNumber(tree);
      return {
        proposition: { id: tree.proposition.id, statement: tree.proposition.statement },
        question: { id: question.id, question: question.question, origin: question.origin },
        path: questionPath(tree, question.id).map((step) => ({
          questionId: step.question.id,
          via: step.via && { sequence: step.via.sequence, answer: step.via.answer }
        })),
        raisedBy: raisedBy && { sequence: raisedBy.sequence, title: raisedBy.title },
        predictions: experiment.predictions,
        sequence: nextCheckpointSequence(tree),
        newQuestionIds: Array.from({ length: newQuestionCount }, (_2, index) => `Q${firstQuestion + index}`)
      };
    },
    async save(draft, artifacts, chain, ctx) {
      const stored = await stores(ctx).checkpoints.write(draft, artifacts, chain);
      const registeredRoots = normalizeArtifactRoots(
        ctx.cwd,
        artifacts.map((item) => inferArtifactRoot(item.artifact))
      );
      runtime.addArtifactRoots(registeredRoots, void 0, false);
      try {
        const server = await startCheckpointViewer(ctx);
        return { stored, viewerUrl: server.latestUrl };
      } catch (error) {
        ctx.ui.notify(`Checkpoint saved, but Viewer is unavailable: ${String(error)}`, "warning");
        return { stored };
      }
    },
    onReached: ({ stored, draft, resultCount }, ctx) => {
      runtime.reachCheckpoint(resultCount, ctx);
      markArtifactRootsPersisted();
      void syncRadar(ctx);
      void refreshPropositionContext(ctx);
      const { proposition_id: propositionId, sequence } = stored.metadata;
      if (propositionId && sequence) {
        pendingHandoff = {
          generation: sessionGeneration,
          propositionId,
          sequence,
          newQuestionIds: (stored.metadata.new_questions ?? []).map((item) => item.id),
          revisionProposal: draft.revisionProposal
        };
      }
    }
  });
  pi.registerTool({
    name: "research_mode",
    label: "Research Work Mode",
    description: "Set the current Research Loop mode. Use Brainstorming to compare options, Exploration to read and understand code or materials, and Experiment before empirical execution. Experiment Mode answers one registered question of the active proposition and requires predictions registered before the run. Disable Research Loop for ordinary implementation work. Call this alone, then proceed with the work.",
    parameters: Type2.Object({
      mode: StringEnum2(["brainstorming", "exploration", "experiment"]),
      objective: Type2.String({ description: "Current objective that justifies this mode" }),
      title: Type2.Optional(Type2.String({ description: "Experiment phase title; required for Experiment Mode" })),
      questionId: Type2.Optional(Type2.String({ description: "Registered question of the active proposition, such as Q3; required for Experiment Mode" })),
      rationale: Type2.Optional(Type2.String({ description: "Why this experiment can answer the question; required for Experiment Mode" })),
      predictions: Type2.Optional(Type2.Array(PREDICTION2, {
        minItems: 2,
        maxItems: 4,
        description: "Outcomes predicted before the run, covering supporting and non-supporting results; copied verbatim into the checkpoint. Required for Experiment Mode"
      })),
      intent: Type2.Optional(
        StringEnum2(["reproduction", "diagnostic", "exploratory", "ablation"], {
          description: "Scientific intent; required for Experiment Mode"
        })
      ),
      plannedDataScope: Type2.Optional(
        Type2.String({ description: "Planned dataset, split, sample count, and scope; required for Experiment Mode" })
      ),
      reference: Type2.Optional(Type2.String({ description: "Reference paper, result, or protocol when applicable" })),
      artifactRoots: Type2.Optional(Type2.Array(
        Type2.String({ description: "Project-relative experiment output directory" }),
        { maxItems: 16, description: "Stable output directories to watch and rescan for artifacts" }
      ))
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let experiment;
      if (params.mode === "experiment") {
        const resolved = await resolveExperiment(params, ctx);
        if (typeof resolved === "string") {
          return { content: [{ type: "text", text: resolved }], details: { accepted: false, mode: params.mode } };
        }
        experiment = resolved;
      }
      const decision = runtime.enterMode(params.mode, params.objective, experiment, ctx);
      if (!decision.block) {
        await syncRadar(ctx);
        await refreshPropositionContext(ctx);
      }
      const text = decision.block ? decision.reason ?? "Mode transition rejected." : [
        `Research Work Mode: ${params.mode.toUpperCase()}`,
        `Objective: ${params.objective}`,
        ...experiment ? [`Question ${experiment.questionId}: ${experiment.question}`] : []
      ].join("\n");
      return { content: [{ type: "text", text }], details: { accepted: !decision.block, mode: params.mode } };
    },
    renderCall(args, theme) {
      const mode = args.mode?.toUpperCase() ?? "MODE";
      return new Text2(theme.fg("toolTitle", theme.bold(`Research ${mode}`)), 0, 0);
    },
    renderResult(result) {
      return new Text2(latexToUnicode(resultText(result)), 0, 0);
    }
  });
  pi.registerTool({
    name: "research_proposition",
    label: "Research Proposition",
    description: "Manage the proposition that experiments test. create records a falsifiable proposition with 1-5 initial questions; revise restates it; both require the user's confirmation. add_question registers another question before experimenting on it. activate switches to an existing proposition. Not available in Experiment Mode.",
    parameters: Type2.Object({
      action: StringEnum2(["create", "revise", "add_question", "activate"]),
      propositionId: Type2.Optional(Type2.String({ description: "Target proposition such as P2; defaults to the active proposition" })),
      statement: Type2.Optional(Type2.String({ description: "create/revise: the proposition as one falsifiable sentence" })),
      background: Type2.Optional(Type2.String({ description: "create: the observation or motivation behind the proposition" })),
      questions: Type2.Optional(Type2.Array(
        Type2.Object({
          question: Type2.String({ description: "One question whose answer bears on the proposition" }),
          rationale: Type2.String({ description: "Why answering it tests the proposition" })
        }),
        { minItems: 1, maxItems: 5, description: "create: initial decomposition of the proposition" }
      )),
      reason: Type2.Optional(Type2.String({ description: "revise: the evidence that requires the revision" })),
      question: Type2.Optional(Type2.String({ description: "add_question: the question" })),
      rationale: Type2.Optional(Type2.String({ description: "add_question: why it bears on the proposition" }))
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const reply = (text, accepted) => ({
        content: [{ type: "text", text }],
        details: { accepted, action: params.action }
      });
      if (runtime.workMode === "experiment") {
        return reply("Finish the experiment with research_checkpoint before changing propositions.", false);
      }
      const { propositions } = stores(ctx);
      const confirm = async (title, message) => {
        if (!ctx.hasUI) return false;
        runtime.setUserDecisionPending(true, ctx);
        try {
          return await ctx.ui.confirm(title, message);
        } catch {
          return false;
        } finally {
          runtime.setUserDecisionPending(false, ctx);
        }
      };
      const declined = (what) => {
        ctx.abort();
        return reply(`The user did not confirm the ${what}. The turn was stopped; do not retry. Ask the user what should change.`, false);
      };
      if (params.action === "create") {
        const questions = params.questions ?? [];
        if (!params.statement?.trim() || questions.length === 0) {
          return reply("create requires statement and at least one initial question.", false);
        }
        const summary = [
          `\u547D\u9898\uFF1A${params.statement.trim()}`,
          ...params.background?.trim() ? [`\u80CC\u666F\uFF1A${params.background.trim()}`] : [],
          "",
          ...questions.map((item, index) => `Q${index + 1}\u3000${item.question}\uFF1A${item.rationale}`)
        ].join("\n");
        if (!await confirm("\u5EFA\u7ACB\u7814\u7A76\u547D\u9898\uFF1F", latexToUnicode(summary))) return declined("proposition");
        const record2 = await propositions.create({ statement: params.statement, background: params.background, questions });
        runtime.setProposition(record2.id, ctx);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record2.id} recorded and active.
${record2.questions.map((item) => `${item.id}: ${item.question}`).join("\n")}`, true);
      }
      const propositionId = params.propositionId?.trim() || runtime.propositionId;
      const record = propositionId ? await propositions.find(propositionId) : void 0;
      if (!record) return reply(`Proposition ${propositionId ?? "(none active)"} was not found.`, false);
      if (params.action === "activate") {
        runtime.setProposition(record.id, ctx);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record.id} is active: ${record.statement}`, true);
      }
      if (params.action === "revise") {
        if (!params.statement?.trim() || !params.reason?.trim()) return reply("revise requires statement and reason.", false);
        const message = `\u539F\u547D\u9898\uFF1A${record.statement}
\u4FEE\u8BA2\u4E3A\uFF1A${params.statement.trim()}
\u7406\u7531\uFF1A${params.reason.trim()}`;
        if (!await confirm(`\u4FEE\u8BA2\u547D\u9898 ${record.id}\uFF1F`, latexToUnicode(message))) return declined("revision");
        await propositions.revise(record.id, params.statement, params.reason);
        await refreshPropositionContext(ctx);
        return reply(`Proposition ${record.id} revised.`, true);
      }
      if (!params.question?.trim() || !params.rationale?.trim()) {
        return reply("add_question requires question and rationale.", false);
      }
      const added = await propositions.addQuestion(record.id, params.question, params.rationale, "agent");
      await refreshPropositionContext(ctx);
      return reply(`Registered ${added.id} under ${record.id}: ${added.question}`, true);
    },
    renderCall(args, theme) {
      const action = args.action ?? "proposition";
      return new Text2(theme.fg("toolTitle", theme.bold(`Research Proposition \xB7 ${action}`)), 0, 0);
    },
    renderResult(result) {
      return new Text2(latexToUnicode(resultText(result)), 0, 0);
    }
  });
  pi.registerTool({
    name: "research_abort_experiment",
    label: "Abort Experiment",
    description: "Leave Experiment Mode only when no interpretable empirical evidence was produced. If negative, failed, or diagnostic evidence exists, use research_checkpoint instead. Call this alone.",
    parameters: Type2.Object({
      reason: Type2.String({ description: "Why the phase produced no interpretable evidence" })
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const decision = runtime.abortExperiment(params.reason, ctx);
      if (!decision.block) {
        markArtifactRootsPersisted();
        await syncRadar(ctx);
      }
      return {
        content: [{
          type: "text",
          text: decision.block ? decision.reason ?? "Abort rejected." : `Experiment aborted: ${params.reason}`
        }],
        details: { accepted: !decision.block }
      };
    },
    renderCall(_args, theme) {
      return new Text2(theme.fg("warning", theme.bold("Abort Experiment")), 0, 0);
    }
  });
  pi.registerCommand("research", {
    description: "Turn Research Loop on or off",
    getArgumentCompletions(prefix) {
      return ["on", "off"].filter((value) => value.startsWith(prefix)).map((value) => ({ value, label: value }));
    },
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();
      if (value === "on" || value === "off") {
        runtime.setEnabled(value === "on", ctx);
        markArtifactRootsPersisted();
        await syncRadar(ctx);
        if (value === "on") await activateLatestProposition(ctx);
        return;
      }
      ctx.ui.notify(`Research Loop: ${runtime.enabled ? "ON" : "OFF"}. Usage: /research on|off`, "info");
    }
  });
  pi.registerCommand("proposition", {
    description: "Show or switch the active research proposition",
    handler: async (_args, ctx) => {
      const records = await stores(ctx).propositions.list();
      if (records.length === 0) {
        ctx.ui.notify("No propositions yet. Describe the proposition to the agent with Research Loop on.", "info");
        return;
      }
      const labels = records.map((record2) => `${record2.id}\u3000${latexToUnicode(record2.statement)}${record2.id === runtime.propositionId ? "\uFF08\u5F53\u524D\uFF09" : ""}`);
      if (ctx.mode !== "tui") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }
      if (runtime.workMode === "experiment") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }
      const selected = await ctx.ui.select("Research propositions", labels);
      const record = records[labels.indexOf(selected ?? "")];
      if (!record) return;
      runtime.setProposition(record.id, ctx);
      await refreshPropositionContext(ctx);
    }
  });
  pi.registerCommand("artifacts", {
    description: "List and preview artifacts from the current research session",
    handler: async (_args, ctx) => {
      await ensureArtifactInventory(ctx);
      const artifacts = getArtifacts();
      if (artifacts.length === 0) {
        ctx.ui.notify("No research artifacts discovered in this session.", "info");
        return;
      }
      const labels = artifacts.map((artifact2, index2) => {
        const summary = artifact2.kind === "dataset" ? `${artifact2.fileCountCapped ? ">=" : ""}${artifact2.fileCount ?? 0} files, ${formatSize(artifact2.size)} sampled` : formatSize(artifact2.size);
        return `${index2 + 1}. ${artifact2.name} [${artifact2.kind}] (${summary}) - ${artifact2.path}`;
      });
      if (ctx.mode !== "tui") {
        ctx.ui.notify(labels.join("\n"), "info");
        return;
      }
      const selected = await ctx.ui.select("Research artifacts", labels);
      if (!selected) return;
      const index = Number.parseInt(selected, 10) - 1;
      const artifact = artifacts[index];
      if (!artifact) return;
      try {
        const preview2 = await loadArtifactPreview(pi, ctx.cwd, artifact);
        await ctx.ui.custom((_tui, theme, _keybindings, done) => {
          const container = new Container2();
          container.addChild(new Text2(theme.fg("accent", theme.bold(preview2.title)), 0, 0));
          container.addChild(new Text2(preview2.text, 0, 1));
          if (preview2.image) {
            container.addChild(
              createTerminalImage(
                preview2.image.data,
                preview2.image.mimeType,
                { fallbackColor: (text) => theme.fg("muted", text) },
                { maxWidthCells: 80, maxHeightCells: 28, filename: artifact.name }
              )
            );
          }
          container.addChild(new Text2(theme.fg("dim", "Enter/Esc to close"), 0, 1));
          return {
            render: (width) => container.render(width),
            invalidate: () => container.invalidate(),
            handleInput: (data) => {
              if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) done(void 0);
            }
          };
        });
      } catch (error) {
        ctx.ui.notify(`Could not preview ${artifact.path}: ${String(error)}`, "warning");
      }
    }
  });
  pi.registerCommand("checkpoint-viewer", {
    description: "Start the persistent Checkpoint Viewer and show its latest URL",
    handler: async (_args, ctx) => {
      try {
        const server = await startCheckpointViewer(ctx);
        ctx.ui.notify(`Checkpoint Viewer: ${server.latestUrl ?? server.origin}`, "info");
      } catch (error) {
        ctx.ui.notify(`Checkpoint Viewer unavailable: ${String(error)}`, "warning");
      }
    }
  });
  pi.events.on(ASK_USER_BLOCKED_EVENT, (payload) => {
    if (!activeContext || !payload || typeof payload !== "object") return;
    const active = payload.active;
    if (typeof active === "boolean") runtime.setUserDecisionPending(active, activeContext);
  });
  pi.on("session_start", (_event, ctx) => {
    artifactAbortController?.abort();
    radar?.stop();
    radar = void 0;
    radarRoots = "";
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = void 0;
    artifactRootsDirty = false;
    const generation = ++sessionGeneration;
    const controller = new AbortController();
    artifactAbortController = controller;
    activeContext = ctx;
    viewerExposureWarned = false;
    loadedArtifactRoots = /* @__PURE__ */ new Set();
    artifactLoadTask = void 0;
    const restored = runtime.startSession(ctx);
    const normalizeRoots = createArtifactRootNormalizer(ctx.cwd);
    const sanitizedRoots = normalizeRoots(runtime.artifactRoots);
    const sanitizedCurrentRoots = normalizeRoots(runtime.currentArtifactRoots);
    const controlStateChanged = runtime.setArtifactRoots(sanitizedRoots, sanitizedCurrentRoots, false);
    if (restored.embeddedArtifacts || controlStateChanged) runtime.persistControlState();
    checkpointStore = void 0;
    propositionStore = void 0;
    checkpointServer = void 0;
    pendingHandoff = void 0;
    setImmediate(() => {
      void (async () => {
        if (!isCurrentSession(ctx, generation, controller.signal)) return;
        if (runtime.enabled) await activateLatestProposition(ctx);
        if (!isCurrentSession(ctx, generation, controller.signal)) return;
        if (restored.embeddedArtifacts) {
          const sanitizedArtifacts = [];
          for (let index = 0; index < restored.legacyArtifacts.length; index += 1) {
            if (index % 200 === 0) {
              await new Promise((resolveYield) => setImmediate(resolveYield));
              if (!isCurrentSession(ctx, generation, controller.signal)) return;
            }
            const artifact = restored.legacyArtifacts[index];
            if (artifact && normalizeRoots([inferArtifactRoot(artifact)]).length > 0) {
              sanitizedArtifacts.push(artifact);
            }
          }
          if (!isCurrentSession(ctx, generation, controller.signal)) return;
          runtime.setArtifacts(sanitizedArtifacts, ctx);
          const migratedRoots = normalizeRoots(sanitizedArtifacts.map(inferArtifactRoot));
          if (runtime.addArtifactRoots(migratedRoots, void 0, false)) runtime.persistControlState();
          if (sanitizedArtifacts.length >= 100) {
            ctx.ui.notify(
              "Legacy artifact state was migrated to roots-only persistence. Existing JSONL history is unchanged; start a new session once to remove its previous startup cost.",
              "warning"
            );
          }
        }
        await syncRadar(ctx, generation, controller.signal);
      })().catch((error) => {
        if (isCurrentSession(ctx, generation, controller.signal)) {
          ctx.ui.notify(`Artifact background initialization failed: ${String(error)}`, "warning");
        }
      });
    });
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    runtime.clearStatus(ctx);
    stopRadar();
    artifactAbortController?.abort();
    artifactAbortController = void 0;
    sessionGeneration += 1;
    loadedArtifactRoots.clear();
    artifactLoadTask = void 0;
    if (artifactRootPersistTimer) clearTimeout(artifactRootPersistTimer);
    artifactRootPersistTimer = void 0;
    artifactRootsDirty = false;
    activeContext = void 0;
    await checkpointServer?.stop();
    checkpointServer = void 0;
    checkpointStore = void 0;
    propositionStore = void 0;
    pendingHandoff = void 0;
  });
  pi.on("agent_settled", async (_event, ctx) => {
    const handoff = pendingHandoff;
    pendingHandoff = void 0;
    if (!handoff || handoff.generation !== sessionGeneration || !ctx.hasUI || !runtime.enabled) return;
    try {
      await runHandoff(handoff, ctx);
    } catch (error) {
      ctx.ui.notify(`Research handoff failed: ${String(error)}`, "warning");
    }
  });
  pi.on("before_agent_start", (event, ctx) => {
    runtime.resetRequest(event.prompt, ctx);
  });
  pi.on("context", (event) => {
    const messages = event.messages.filter(
      (message) => !(message.role === "custom" && "customType" in message && message.customType === POLICY_MESSAGE)
    );
    const policy = runtime.policy();
    if (!policy) return { messages };
    const policyMessage = {
      role: "custom",
      customType: POLICY_MESSAGE,
      content: policy,
      display: false,
      timestamp: Date.now()
    };
    return { messages: [...messages, policyMessage] };
  });
  pi.on("turn_start", () => runtime.startTurn());
  pi.on("tool_call", (event, ctx) => {
    return runtime.evaluateToolCall(event.toolName, event.input, ctx);
  });
  pi.on("tool_execution_start", () => {
    if (runtime.enabled) radar?.beginCapture();
  });
  pi.on("tool_result", (event, ctx) => {
    if (!runtime.enabled || !shouldAbortForCancelledQuestionnaire(event.toolName, event.details)) return;
    ctx.abort();
    ctx.ui.notify("Research decision questionnaire was cancelled; the current turn was stopped.", "info");
  });
  pi.on("tool_execution_end", () => {
    if (runtime.enabled) radar?.endCapture();
  });
}
export {
  researchLoop as default
};

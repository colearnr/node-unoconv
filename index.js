'use strict';

var _ = require('underscore'),
    childProcess = require('child_process'),
    mime = require('mime');

var unoconv = exports = module.exports = {};

/**
* Convert a document.
*
* @param {String} file
* @param {String} outputFormat
* @param {Object|Function} options
* @param {Function} callback
* @api public
*/
unoconv.convert = function(file, outputFormat, options, callback) {
    var self = this,
        args,
        bin = 'unoconv',
        child,
        stdout = [],
        stderr = [];

    if (_.isFunction(options)) {
        callback = options;
        options = null;
    }

    args = [
        '-f' + outputFormat
    ];

    if (options) {
        if (options.port) {
            args.push('-p' + options.port)
        }
        if (options.verbose) {
            args.push('-v');
        }
        if (options.output) {
            args.push('--output');
            args.push(options.output);
        }
        if (options.stdout) {
            args.push('--stdout');
        }
        if (options.doctype) {
            args.push('-d' + options.doctype);
        }
        if (options.exportStr) {
            args.push('-e' + options.exportStr);
        }
        if (options.nolaunch) {
            args.push('-n');
        }
        if (options.template) {
            args.push('-t' + options.template);
        }
        if (options.timeout) {
            args.push('-T' + options.timeout);
        }
        if (options.pidfile) {
            args.push('--pidfile');
            args.push(options.pidfile);
        }
    }
    args.push(file);

    if (options && options.bin) {
        bin = options.bin;
    }

    child = childProcess.spawn(bin, args);

    child.stdout.on('data', function (data) {
        stdout.push(data);
    });

    child.stderr.on('data', function (data) {
        stderr.push(data);
    });

    child.on('exit', function (code, signal) {
        if (code !== 0 && stderr.length) {
            return callback(new Error(Buffer.concat(stderr).toString()));
        }

        callback(null, Buffer.concat(stdout));
    });
};

/**
* Start a listener.
*
* @param {Object} options
* @return {ChildProcess}
* @api public
*/
unoconv.listen = function (options) {
    var self = this,
        args,
        bin = 'unoconv';

    args = [ '--listener' ];

    if (options && options.port) {
        args.push('-p' + options.port);
    }

    if (options && options.bin) {
        bin = options.bin;
    }

    return childProcess.spawn(bin, args);
};

/**
* Detect supported conversion formats.
*
* @param {Object|Function} options
* @param {Function} callback
*/
unoconv.detectSupportedFormats = function (options, callback) {
    var self = this,
        docType,
        detectedFormats = {
            document: [],
            graphics: [],
            presentation: [],
            spreadsheet: []
        },
        bin = 'unoconv';

    if (_.isFunction(options)) {
        callback = options;
        options = null;
    }

    if (options && options.bin) {
        bin = options.bin;
    }

    childProcess.execFile(bin, [ '--show' ], function (err, stdout, stderr) {
        if (err) {
            return callback(err);
        }

        // For some reason --show outputs to stderr instead of stdout
        var lines = stderr.split('\n');

        lines.forEach(function (line) {
            if (line === 'The following list of document formats are currently available:') {
                docType = 'document';
            } else if (line === 'The following list of graphics formats are currently available:') {
                docType = 'graphics';
            } else if (line === 'The following list of presentation formats are currently available:') {
                docType = 'presentation';
            } else if (line === 'The following list of spreadsheet formats are currently available:') {
                docType = 'spreadsheet';
            } else {
                var format = line.match(/^(.*)-/);

                if (format) {
                    format = format[1].trim();
                }

                var extension = line.match(/\[(.*)\]/);

                if (extension) {
                    extension = extension[1].trim().replace('.', '');
                }

                var description = line.match(/-(.*)\[/);

                if (description) {
                    description = description[1].trim();
                }

                if (format && extension && description) {
                    detectedFormats[docType].push({
                        'format': format,
                        'extension': extension,
                        'description': description,
                        'mime': mime.lookup(extension)
                    });
                }
            }
        });

        if (detectedFormats.document.length < 1 &&
            detectedFormats.graphics.length < 1 &&
            detectedFormats.presentation.length < 1 &&
            detectedFormats.spreadsheet.length < 1) {
            return callback(new Error('Unable to detect supported formats'));
        }

        callback(null, detectedFormats);
    });
};

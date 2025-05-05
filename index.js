const https = require('https');
const url = require('url');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));

const help = argv.help;
if (help) {
    const helpMessage = `
    Simple script to download media from HLS playlist and concatenate into a file

    Available arguments:
      --help                  Show this help description.

      --url <remote_url>      Specify a remote URL for an HLS media playlist. This cannot
                              be a multivariant playlist (MVP).

      --output <local_url>    Specify the output URL for the media file (without the
                              extension as this will be determined by the downloaded
                              files). If no URL is specified then the default filename of
                              output will be used.
    `;
    console.log(helpMessage);
    return;
}

const playlistUrl = argv.url;
const outputFileName = argv.output || "output";
if (!playlistUrl) {
    throw new Error('Must pass URL via --url option')
}

let fileTypeHint = 'ts';

/**
 * @param {string} remoteUrl
 * @returns {Promise<Buffer>}
 */
function getFile(remoteUrl) {
    return new Promise((resolve, reject) => {
        https.get(remoteUrl, {encoding: null}, response => {
            if (response.statusCode != 200) {
                reject(new Error(`Invalid status code: ${response.statusCode} - ${response.statusMessage}`));
                response.resume();
                return;
            }
            let data = [];
            let connectionError;
            response.on('data', (chunk) => {
                data.push(chunk);
            });
            response.on('error', (error) => {
                connectionError = error;
            });
            response.on('close', () => {
                if (connectionError) {
                    reject(connectionError);
                } else {
                    resolve(Buffer.concat(data));
                }
            });
        });
    });
}

/**
 * @param {string} playlist
 * @returns {{initUrl: string?, segmentUrls: string[]}}
 */
function getSegmentUrlsFromPlaylist(playlist) {
    const urls = {segmentUrls: []};
    const lines = playlist.split(/\r?\n|\r|\n/g);
    for (const line of lines) {
        if (line.startsWith('#')) {
            // Tag line
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                throw new Error('Playlist file was multivariant (MVP) but must be media');
            } else if (line.startsWith('#EXT-X-KEY')) {
                throw new Error('Currently no support for encrypted content');
            } else if (line.startsWith('#EXT-X-BYTERANGE')) {
                throw new Error('Currently no support for byterange addressing on segments');
            } else if (line.trim() == '#EXT-X-DISCONTINUITY') {
                // This one will require me to save multiple files (probably to a directory).
                throw new Error('Currently no support for playlists containing discontinuities');
            } else if (line.startsWith('#EXT-X-MAP')) {
                // This one should be quite do-able and what I will do next.
                throw new Error('Currently no support for parsing out EXT-X-MAP segment');
            }
        } else {
            // URL line
            const trimmedLine = line.trim();
            if (trimmedLine == '') continue;
            urls.segmentUrls.push(trimmedLine);
        }
    }
    return urls;
}

/**
 * @param {{baseUrl: string, initUrl: string?, segmentUrls: string[]}} urls
 * @returns {Promise<Buffer>}
 */
function getCombinedMediaFile(urls) {
    if (urls.segmentUrls.length == 0) {
        throw new Error('No media segment URLs in playlist');
    }
    let downloadUrls = [];
    if (urls.initUrl) {
        downloadUrls.push(url.resolve(urls.baseUrl, urls.initUrl));
    }
    downloadUrls = downloadUrls.concat(urls.segmentUrls.map(v => url.resolve(urls.baseUrl, v)));
    updateFileTypeHint(downloadUrls);
    console.log(`Going to download ${downloadUrls.length} files`);
    const downloadPromises = downloadUrls.map(v => getFile(v));
    return Promise.all(downloadPromises).then(files => Buffer.concat(files));
}

/**
 * @param {string[]} downloadUrls
 */
function updateFileTypeHint(downloadUrls) {
    if (downloadUrls.length == 0) return;
    const lastUrl = downloadUrls[downloadUrls.length - 1];
    const extension = getFileExtension(lastUrl);
    if (extension) {
        fileTypeHint = extension;
    }
}

/**
 * 
 * @param {string} someUrl
 * @returns {string?}
 */
function getFileExtension(someUrl) {
    const parsedUrl = new url.URL(someUrl);
    const pathSplit = parsedUrl.pathname.split('/');
    const lastPathComponent = pathSplit[pathSplit.length - 1];
    const extensionSplit = lastPathComponent.split('.');
    if (extensionSplit.length < 2) return undefined;
    const extension = extensionSplit[extensionSplit.length - 1];
    if (extension) {
        return extension
    }
}

/**
 * @param {string} path
 * @param {Buffer} file
 */
function saveCombinedMediaFile(path, file) {
    fs.writeFileSync(path, file);
}

getFile(playlistUrl)
    .then(playlist => {
        const urls = getSegmentUrlsFromPlaylist(playlist.toString());
        urls.baseUrl = playlistUrl;
        return getCombinedMediaFile(urls);
    })
    .then(mediaFile => {
        const outputFileExtension = getFileExtension(url.resolve(playlistUrl, outputFileName));
        if (outputFileExtension) {
            saveCombinedMediaFile(outputFileName, mediaFile);
        } else {
            saveCombinedMediaFile(`${outputFileName}.${fileTypeHint}`, mediaFile);
        }
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });

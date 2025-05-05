# download-hls

Make sure that `node_modules` are installed first (e.g. run `npm i` in root of repo).

The script requires Node.js to run. Execute it by running `node index.js` and configuring via the following arguments:
```
Simple script to download media from HLS playlist and concatenate into a file

Available arguments:
    --help                  Show this help description.

    --url <remote_url>      Specify a remote URL for an HLS media playlist. This cannot
                            be a multivariant playlist (MVP).

    --output <local_url>    Specify the output URL for the media file (without the
                            extension as this will be determined by the downloaded
                            files). If no URL is specified then the default filename of
                            output will be used.
```

## Example

```
% node index.js --url "https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/Job2dae5735-d6ca-48ca-91be-0ec0bead535c-107702578-hls_bundle_hls240/prog_index.m3u8"
Going to download 20 files
% ls
index.js		node_modules		output.mp4		package-lock.json	package.json		README.md
```

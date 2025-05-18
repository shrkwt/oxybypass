# oxycors - cors proxy for hls media

Are you sick of having to deal with those annoying CORS issues when you try to stream your {or maybe not yours 😉} M3U8 files?

To address playback issues on Shaka players, certain modifications have been made in this version.

## ⚙ How it works?

Your requests and the hls stream files/video chunks you're attempting to access are interconnected by this Node.js application in the backend. Simply enter your M3U8 manifest link in the input field, and rest is handled by `oxycors`. The M3U8 file is proxied by oxycors server, which also gives you a new URL to utilize that is free of CORS issues.

## Deployment

### Vercel

Host your own instance of Hls-Proxy on vercel

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/shrkwy/oxycors)
### Render

Host your own instance of Hls-Proxy on Render.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shrkwy/oxycors)

### Cloudflare-worker
 - Make a simple cf worker.
 - After the worker has been deployed, modify its code by replacing it with the one found in `hls-proxy(cf_worker).js`.
 - Deploy your worker!

## 👩‍💻 Usage

For direct usage, append the hls(.m3u8) url to end replacing "your_url_here", i.e, pass the manifest as the 'url' parameter for route hls-proxy:

[https://<deployed_web_server>/hls-proxy?url=your_url_here](https://<deployed_web_server>/hls-proxy?url=your_url_here)

For example, if your hls link is `https://example.com/stream.m3u8`, you would use:

[https://<deployed_web_server>/hls-proxy?url=https://example.com/stream.m3u8](https://<deployed_web_server>/hls-proxy?url=https://example.com/stream.m3u8)

## <span>🔐 Envs</span>

More info can be found in [`.env.example`](https://github.com/oxycors/oxycors/blob/main/.env.example) file

- `HOST`: host of your oxycors proxy server `optional`
- `PORT`: port number (any) `optional`
- `PUBLIC_URL`: public url of your oxycors deployment `mandatory`
- `ALLOWED_ORIGINS`: origins to allow the  usage of oxycors deployment `mandatory`


## 📹 Example Code Snippet

Here’s how you can use Video.js to play the proxied URL:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxied Hls Stream</title>
    <link href="https://vjs.zencdn.net/7.21.0/video-js.css" rel="stylesheet">
</head>
<body>
    <div class="video-container">
        <video id="my-video" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" width="640" height="360">
            <source src="PROXIED_M3U8_URL_HERE" type="application/x-mpegURL">
        </video>
    </div>

    <script src="https://vjs.zencdn.net/7.21.0/video.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/videojs-contrib-hls@latest"></script>
    <script>
        var player = videojs('my-video');
    </script>
</body>
</html>

```

## 🤝 Contributing

Feel free posting issues or pull requests if you encounter one or have suggestions to improve!

<br/>

<p align="center" style="text-decoration: none;">Based on <a href="https://github.com/itzzzme/m3u8proxy" target="_blank">@itzzzme/m3u8-proxy 
</a></p>


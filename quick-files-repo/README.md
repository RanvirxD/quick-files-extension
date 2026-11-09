# Quick Files

**Keep your most-used files one click away, and drag them into any website.**

Tired of digging through folders to find your resume every time a job portal asks for it? Quick Files adds a side panel to your browser where you save important files once (resume, ID, portfolio, certificates) and drag them straight into any upload box.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome](https://img.shields.io/badge/Chrome-supported-brightgreen)
![Brave](https://img.shields.io/badge/Brave-supported-brightgreen)
![Edge](https://img.shields.io/badge/Edge-supported-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Side panel:** click the toolbar icon and your saved files are right there, and the panel stays open while you drag.
- **Real drag and drop:** drop a file on any upload box or drop zone and it attaches like a normal file from your computer.
- **📎 Attach button:** one click attaches a file to the upload box on the page you're viewing, for sites that ignore dragging.
- **Always up to date:** in browsers that support it, the extension links to your original file, so edits to your resume are picked up automatically.
- **Works everywhere:** Chrome, Brave and Edge, with a fallback for browsers that lack the file-link feature.
- **Private:** everything stays on your computer. No accounts, servers, analytics or network requests.

## Install

The extension isn't on the Chrome Web Store, so you load it manually (about a minute).

1. **Download** this repo: click **Code → Download ZIP** and unzip it, or run:
   ```bash
   git clone https://github.com/RanvirxD/quick-files-extension.git
   ```
2. Open `chrome://extensions` (in Brave use `brave://extensions`, in Edge `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `quick-files-extension` folder, the one containing `manifest.json`.
5. Click the puzzle-piece icon in the toolbar and **pin** Quick Files.

## Usage

1. Click the **Quick Files** icon to open the side panel.
2. Click **+ Add files**, then **Choose files…** and pick your resume or other files.
3. On any page with an upload box, **drag the file from the panel onto it**. You can also click 📎 next to the file.
4. Remove a file from the list with **✕** (this never deletes the real file).
5. Click **Close panel** at the bottom when you're done.

> **After installing or updating, refresh any tabs that were already open.** Chrome only injects the page script into pages loaded after the extension is installed.

## How it works

| Part | File | Job |
| --- | --- | --- |
| Side panel | `sidepanel.html`, `sidepanel.js`, `sidepanel.css` | Lists saved files and starts the drag |
| Add page | `add.html`, `add.js` | Full-tab page for choosing files, because browsers don't allow the file picker inside a side panel |
| Page script | `content.js` | Catches drops on websites and hands the page a real `File` |
| Background | `background.js` | Opens the side panel when you click the icon |

Chrome doesn't pass real files from a side panel to a web page. So the drag carries only an ID, and the page script asks the panel for that file and recreates the drop on the page.

### Links vs. copies

- **Chrome and Edge** use the File System Access API. The extension stores a **link** to your file, so changes to the file show up automatically. After restarting the browser you may need to click **Unlock** once to re-grant read access.
- **Brave and other browsers** without that API fall back to storing a **copy** inside the extension. To update it, add the file again with the same name and the copy is replaced.

## Permissions

| Permission | Why |
| --- | --- |
| `sidePanel` | Shows the file list beside the page |
| Run on all sites (`<all_urls>` content script) | Lets the page script receive drops on whatever site you're using |

The page script does nothing unless you drop a Quick Files item onto the page. It makes no network requests, and your files never leave your device. The code is small enough to read: start with [`content.js`](content.js).

## Limitations

- Some sites with unusual upload widgets may ignore the drag. Use the 📎 button there.
- Chromium browsers only (Chrome, Brave, Edge, Opera, etc.). Firefox and Safari aren't supported.
- Pages like `chrome://` and the Chrome Web Store block extensions from running scripts.
- Very large files (hundreds of MB) can be slow, because they are passed to the page in memory.

## Troubleshooting

- **Nothing happens when I drop a file:** refresh the page and try again, or use 📎.
- **A file shows "Locked":** click **Unlock** at the top of the panel.
- **A file shows "File moved or deleted":** remove it and add it again from its new location.
- **Add files shows an error:** reload the extension at `chrome://extensions` and reopen the panel.

## Contributing

Issues and pull requests are welcome. To work on it, load the folder unpacked as above, edit the files, then click the reload icon on the extension's card in `chrome://extensions`.

Ideas for later:
- Folders or tags for saved files
- Rename a file's display label
- Keyboard shortcut to open the panel
- Firefox support

## License

[MIT](LICENSE) © 2026 Ranvir Singh

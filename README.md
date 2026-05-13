# Peek

A powerful static file server with Windows 11 style file manager interface. Built with Node.js, this tool allows you to serve static files and manage them through a beautiful web-based file explorer.

## Features

- **Windows 11 Style Interface** - Modern UI similar to Windows File Explorer
- **File Management** - Create, edit, delete, and rename files and folders
- **Directory Navigation** - Browse through nested folders easily
- **Search Functionality** - Filter files in real-time
- **Bulk Operations** - Select multiple items and delete them at once
- **Security Restrictions** - File type and size limitations for safety
- **Clipboard Support** - Copy server URL to clipboard
- **CLI Control** - Full server control from command line
- **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Prerequisites
- Node.js 14.0 or higher
- npm or yarn package manager

### Install from source

```bash
git clone https://github.com/aydope/Peek.git
cd Peek
npm install
```

### Install Dependencies

```bash
npm install commander chalk clipboardy ora
```

## Global CLI Tool Installation

You can install Peek globally to use it as a command-line tool from anywhere.

### Global Installation

```bash
npm install -g .
```

Or if publishing to npm:

```bash
npm install -g peek
```

### After Global Installation

```bash
# Start the server
peek start --port 3000 --dir ./myfiles

# Start in CLI mode
peek cli

# Start with custom options
peek start --port 8080 --dir ./public

# Show help
peek --help
```

### Using npx (without installation)

Run directly without installing:

```bash
npx peek start
npx peek start --port 8080
npx peek cli
```

### Local Development Link

For development, create a symlink globally:

```bash
npm link
```

Then use the command:

```bash
peek start
```

### Uninstall

To remove the global installation:

```bash
npm uninstall -g peek
```

## Usage

### Quick Start

Start the server with default settings:

```bash
node server.js start
```

> Then open your browser and navigate to http://localhost:3000

### Command Line Interface

Start interactive CLI mode:

```bash
node server.js cli
```


### Command Line Options

| Option | Description | Default |
| ------ | ----------- | ------- |
| `-p, --port <number>` | Set server port | 3000 |
| `-d, --dir <path>` | Set serving directory | ./public |

### Examples

Start server on port 8080:

```bash
node server.js start --port 8080
```

Start server with custom directory:

```bash
node server.js start --dir ./myfiles
```

Start CLI mode with custom settings:

```bash
node server.js cli --port 3000 --dir ./downloads
```

### CLI Commands

Once in interactive CLI mode, you can use these commands:

| Command | Description |
| ------- | ----------- |
| `start` |	Start the HTTP server |
| `stop` | Stop the HTTP server |
| `restart` | Restart the HTTP server |
| `status` | Show server status |
| `port` | Change server port |
| `dir` | Change serving directory |
| `copy` | Copy server URL to clipboard |
| `help` | Show help information |
| `clear` | Clear console |
| `exit` | Exit the CLI |

## File Manager Interface

### Features Available in Web Interface

#### File Operations

- **Create File** - Create new text files with content
- **Edit File** - Modify existing text files
- **Delete File** - Remove single or multiple files
- **Rename** - Change folder names
- **Create Folder** - Create new nested folders

#### Navigation

- **Breadcrumb Trail** - Easy navigation through folder structure
- **Back Button** - Navigate to previous folder
- **Directory Listing** - View all files and folders
- **Search Box** - Filter files by name in real-time

#### Bulk Operations

- **Select Multiple** - Checkbox selection for multiple items
- **Bulk Delete** - Delete multiple selected items at once

### Security Restrictions

The server enforces these security limits:

| Restriction | Limit |
| ----------- | ----- |
| Allowed File Types | .txt, .js, .html, .css, .json, .md, .xml, .jpg, .png, .gif, .svg |
| Maximum File Size | 10 MB |
| Restricted Paths | node_modules, .git, .env |
| Access Restriction | Files cannot be accessed outside public directory |

## API Endpoints

The server provides REST API endpoints for file operations:

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/files` | POST |	Create a new file |
| `/api/files/{path}` | GET | Read file content |
| `/api/files/{path}` | PUT | Update file content |
| `/api/folders` | POST | Create a new folder |
| `/api/delete` | DELETE | Delete a file or folder |
| `/api/delete-multiple` | DELETE | Delete multiple items |
| `/api/rename` | PUT | Rename a file or folder |

### API Examples

Create a file:

```bash
curl -X POST http://localhost:3000/api/files \
  -H "Content-Type: application/json" \
  -d '{"path":"test.txt","content":"Hello World"}'
```

Read a file:

```bash
curl http://localhost:3000/api/files/test.txt
```

Update a file:

```bash
curl -X PUT http://localhost:3000/api/files/test.txt \
  -H "Content-Type: application/json" \
  -d '{"content":"Updated content"}'
```

Create a folder:

```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -d '{"path":"newfolder"}'
```

Delete a file:

```bash
curl -X DELETE http://localhost:3000/api/delete \
  -H "Content-Type: application/json" \
  -d '{"path":"test.txt","type":"file"}'
```

Delete multiple items:

```bash
curl -X DELETE http://localhost:3000/api/delete-multiple \
  -H "Content-Type: application/json" \
  -d '{"paths":["file1.txt","file2.txt","folder1"]}'
```

Rename an item:

```bash
curl -X PUT http://localhost:3000/api/rename \
  -H "Content-Type: application/json" \
  -d '{"oldPath":"oldname.txt","newName":"newname.txt"}'
```

## Project Structure

```bash
Peek/
├── index.js          # Main server file
├── package.json       # Dependencies and scripts
├── public/           # Default serving directory
│   ├── welcome.txt   # Sample file
│   └── sample.html   # Sample HTML file
└── README.md         # Documentation
```

## Configuration

You can modify these settings in the code:

```js
// Allowed file extensions
#allowedFileTypes = ['.txt', '.js', '.html', '.css', '.json', ...];

// Maximum file size (10MB)
#maxFileSize = 10 * 1024 * 1024;

// Restricted paths
#restrictedPaths = ['node_modules', '.git', '.env'];
```

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, start the server with a different port:

```bash
node server.js start --port 8080
```

### Cannot Access Files

Ensure files are placed inside the `public` directory (or your specified directory).

### File Type Not Allowed

Only files with allowed extensions can be created. Check the allowed types list.

### Permission Denied

Make sure you have read/write permissions for the serving directory.

### Error: ENOENT

This means the file or directory doesn't exist. Check the path and try again.

## Development

### Running in Development Mode

```bash
node server.js cli
```

### Adding New File Types

Edit the `#allowedFileTypes` array in the code:

```js
#allowedFileTypes = ['.txt', '.js', '.html', '.css', '.json', '.md', '.xml', '.jpg', '.png', '.gif', '.svg', '.your-ext'];
```

### Customizing UI

The UI HTML/CSS is generated in the `#generateWindows11Explorer` method. You can modify the styles and layout there.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Edge (latest)
- Safari (latest)

## Package.json Scripts

```bash
{
  "scripts": {
    "start": "node index.js start",
    "cli": "node index.js cli",
    "dev": "node index.js start --port 3000",
    "help": "node index.js --help"
  }
}
```

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

- Inspired by Windows 11 File Explorer design
- Built with Node.js and modern web technologies
- Icons and design elements from Windows 11

## Contact

For issues and suggestions, please open an issue on GitHub.

Enjoy managing your files with Peek! 🚀

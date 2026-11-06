# Coral Studio

**A desktop workspace for creating, editing, building, and previewing static websites.**

Coral Studio brings project files, Markdown content, JSON configuration, media, the site builder, and a local preview into one window. This guide explains the main workflow, workspace areas, editor controls, menus, and keyboard shortcuts.

## Contents

- [Quick start](#quick-start)
- [Workspace layout](#workspace-layout)
- [Everyday workflow](#everyday-workflow)
- [Code editor](#code-editor)
- [Markdown editor](#markdown-editor)
- [JSON editor](#json-editor)
- [Structure, media, preview, and settings](#structure-media-preview-and-settings)
- [Menus and workspace buttons](#menus-and-workspace-buttons)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Preferences](#preferences)
- [Demo project](#demo-project)
- [Run Coral Studio from source](#run-coral-studio-from-source)

## Quick start

1. Launch Coral Studio. On the welcome screen, choose **New project** to create a site, or **Open project** to select an existing project folder. Choose a recent project to return to it.
2. In an open project, use the Explorer to browse pages, templates, data, configuration, and assets. Double-click a file to open it in its matching editor. Use the activity bar to switch workspace areas.
3. Edit files and save them with **Ctrl+S**. The status bar indicates whether changes are saved.
4. Choose **Project → Build site** or press **Ctrl+Shift+B**. Check the build result, then open **Preview** to inspect the generated pages.

The project remains a normal folder on disk. Use **Project → Show project folder** to open it in the system file manager.

## Workspace layout

| Area | Purpose |
| --- | --- |
| **Dashboard** | Project overview and the in-app usage guide. |
| **Code** | Edit HTML, CSS, JavaScript, and other text files in Monaco, with syntax coloring and line numbers. |
| **Markdown** | Write Markdown in a visual editor or source mode, with formatting tools and an optional rendered preview. |
| **JSON** | Edit supported project JSON files as form fields or raw JSON. |
| **Structure** | Inspect the site’s pages and content structure. Refresh it after changing project content. |
| **Media** | Browse and inspect images, audio, and video in the project; import supported media. |
| **Preview** | Browse built pages locally and check common viewport widths. |
| **Settings** | Edit site settings. |
| **Application settings** | Set the app theme, accent, editor options, saving behavior, and workspace dimensions. |

The **Explorer** lists project files and content on the left. The toolbar changes with the selected workspace. The bottom status bar shows the project path, save state, editor position or Markdown word count, build status, and interface zoom where applicable.

## Everyday workflow

### Create or open a project

- On the welcome screen, click **New project** and provide the requested project name and options. If offered, enable `index.md` to start with a Markdown home page.
- Click **Open project** to choose a project folder. The **File → Open recent** menu provides shortcuts to recently opened projects.
- With a project open, **File → Close project** returns to the welcome screen. If there are unsaved changes, the app asks before discarding them.

### Find and open files

- Browse folders and files in the Explorer; double-click a file to open it.
- Press **Ctrl+K** or **Ctrl+P** to open the command palette. Search for files, pages, workspace areas, and available commands.
- Open files appear as tabs. Click a tab to switch files. Use **Ctrl+Tab** to move to the next editor tab, or **File → Close tab** / **Ctrl+W** to close the current code tab.
- Right-click a file or content item for its contextual actions, such as opening, copying its path, renaming, duplicating, previewing, or deleting it. The available actions depend on the selected item.

### Save, build, and preview

- **Ctrl+S** saves the active document. **Ctrl+Shift+S** saves all open documents.
- Build with **Project → Build site**, the build button in Preview, or **Ctrl+Shift+B**.
- Open **Preview** from the activity bar or **Project → Open preview**. Enter a built page path and press **Enter** to navigate to it.
- The Preview toolbar has **Fit**, **Tablet**, and **Phone** viewport buttons, **Reload preview**, **Open in browser**, and **Build site**.
- If a page does not reflect recent edits, save the files, build again, and reload Preview.

## Code editor

Open a source file from the Explorer to use the Monaco code editor. It provides language syntax coloring, line numbers, bracket matching, and standard text editing.

| Control | What it does |
| --- | --- |
| **Find** | Open the in-file search bar. Use the arrows to move between matches. |
| **Replace** | Show the replacement field, then replace the current match or all matches. |
| **Go to line** | Jump to a line number. |
| **Comment** | Toggle a line comment for the current line or selection. |
| **Duplicate** | Duplicate the current line or selection. |
| **Indent / Outdent** | Adjust indentation for the current selection. |
| **Wrap** | Toggle visual wrapping of long lines. |
| **Copy path** | Copy the open file’s project-relative path. |
| **Save / Save all** | Save the active file or all open files from the toolbar or File menu. |

Use **F3** and **Shift+F3** to move to the next and previous search results while the search bar is open. Press **Esc** to close the search bar. **Ctrl+G** opens Go to line.

## Markdown editor

Open a `.md` file to edit it. The document strip shows the path, save state, word count, and character count. Multiple Markdown documents can remain open in tabs.

### Choose an editing view

- **Visual editor** edits the rendered document directly.
- **Markdown source** edits the Markdown text.
- **Toggle preview** shows or hides a rendered preview beside the document.
- Formatting actions work with the selected text or current block. In source mode they insert or toggle Markdown syntax where supported.

### Markdown toolbar reference

| Group | Buttons and purpose |
| --- | --- |
| **History** | **Undo** and **Redo** editing. |
| **Inline** | **Bold**, **Italic**, **Underline**, **Strikethrough**, **Inline code**, and **Clear formatting**. |
| **Headings** | **Paragraph** and **Heading 1–6**. |
| **Lists & blocks** | **Bulleted list**, **Numbered list**, **Task list**, **Block quote**, **Code block**, **Indent**, **Outdent**, and **Horizontal rule**. |
| **Insert** | **Insert link**, **Remove link**, **Insert table**, **Insert image**, switch between visual/source mode, and toggle preview. |
| **Search** | **Find** or **Replace** in the current document. |
| **Document** | **Save document** or **Save all Markdown files**. |

In the search bar, type a query and use the up/down arrows to move between matches. When Replace is active, enter replacement text and choose **Replace** for the selected match or **All** for every match. Press **Enter** in the search field for the next match, **Shift+Enter** for the previous match, and **Esc** to close search.

## JSON editor

Open a supported `.json` project file from the Explorer. Use **Form** for editable fields when the file contains an object, or **JSON** to edit the source directly. Some project mapping files have a dedicated mapping form.

| Button | What it does |
| --- | --- |
| **Form / JSON** | Switch between structured fields and raw JSON. Form mode is unavailable when the JSON cannot be represented as an object or has a parse error. |
| **Format JSON** | Indent and format valid JSON for readability. |
| **Compact JSON** | Remove formatting whitespace from valid JSON. |
| **Validate JSON** | Check the JSON and report parsing or validation errors. |
| **Copy JSON** | Copy the JSON text. |
| **Save JSON** | Save valid, error-free changes. |

For project file mappings, use **+ Add file mapping** to add a source-to-output path pair, and the **×** button to remove a mapping. Save only after correcting any reported errors.

## Structure, media, preview, and settings

### Structure

Use **Structure** to inspect the site’s pages and content. Click **Refresh site structure** after making content changes if the displayed structure is out of date.

### Media

**Media** displays supported media files found in the project. Click a tile to inspect an image or play a video. Use **Import media** to choose an image or video and a destination folder inside the project. In the image viewer, use the mouse wheel to zoom and double-click the image to reset zoom; press **Esc** to close the viewer.

### Preview

Preview displays the built site in an embedded browser. Enter a path such as `index.html` in the path field and press **Enter**. Use **Fit**, **Tablet**, or **Phone** to change the preview width. **Reload preview** refreshes the current page, **Open in browser** opens it externally, and **Build site** regenerates the site.

### Site settings

Open **Project → Site settings** or the **Settings** workspace to edit project-level settings. Use **Save settings** or **Ctrl+S** to save changes.

### Integrated PowerShell terminal

Press **Ctrl+J** or click the terminal button to show or hide the integrated PowerShell terminal. Enter a command and press **Enter** to run it. Use **Up** and **Down** in the command field to recall terminal history. The terminal runs in the current project context.

## Menus and workspace buttons

The top menu bar contains **File**, **Edit**, **View**, **Project**, and **Help**.

| Menu | Common commands |
| --- | --- |
| **File** | New/Open project, Open recent, create supported new files or content, Save, Save all, close tabs, and close project. |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Select all, and Search project / command palette. |
| **View** | Toggle the sidebar, terminal, developer tools, fields panel, live preview, and focus mode; switch workspaces; zoom; change editor text size; reset panel layout; enter full screen. |
| **Project** | Build site, open Preview, open Site settings, open the preview in a browser, show the project folder, and access project-specific actions when available. |
| **Help** | Keyboard shortcuts, template syntax, developer tools, and About Coral Studio. |

The left activity bar switches workspaces. The toolbar beside it exposes actions for the current workspace, including sidebar and terminal toggles, project-folder access, application settings, file actions, and workspace-specific editor or preview tools. Buttons show their names in tooltips when hovered.

The **Help → Keyboard shortcuts** dialog (also **F1**) lists shortcuts. **Help → Template syntax** describes the template expressions used by the site engine.

## Keyboard shortcuts

`Ctrl` means **Control** on Windows and Linux. On macOS, the app also recognizes **Command** for editor actions that support the platform modifier.

### Project and editing

| Shortcut | Action |
| --- | --- |
| **Ctrl+K** or **Ctrl+P** | Open the command palette to search pages, files, workspace areas, or commands. |
| **Ctrl+S** | Save the active document (or save the current settings page). |
| **Ctrl+Shift+S** | Save all open documents. |
| **Ctrl+F** | Find in the open code or Markdown document. |
| **Ctrl+H** | Replace in the open code or Markdown document. |
| **Ctrl+G** | Go to line in the code editor. |
| **F3** / **Shift+F3** | Next / previous match while in-file search is open. |
| **Ctrl+Shift+B** | Build the site. |
| **Ctrl+W** | Close the active code editor tab. |
| **Ctrl+Tab** | Move to the next editor tab; add **Shift** to move backwards. |

### Workspace and window

| Shortcut | Action |
| --- | --- |
| **Alt+1** … **Alt+4** | Switch to Dashboard, Code, Media, or Preview. |
| **Ctrl+B** | Show or hide the sidebar. |
| **Ctrl+J** | Show or hide the integrated PowerShell terminal. |
| **Ctrl+\\** | Show or hide the live preview panel. |
| **Ctrl+Alt+B** | Show or hide the fields panel. |
| **Ctrl+.** | Toggle focus mode, which leaves the writing pane in focus. |
| **Ctrl++** / **Ctrl+-** / **Ctrl+0** | Zoom the interface in / out / reset zoom. |
| **F11** | Toggle full screen. |
| **F12** or **Ctrl+Shift+I** | Show or hide developer tools. |
| **F1** | Open the Keyboard shortcuts help dialog. |

### Explorer and panels

| Shortcut / gesture | Action |
| --- | --- |
| **F2** | Rename the selected Explorer file or content item. |
| **Delete** | Delete the selected Explorer item after confirmation. |
| **Enter** | Open a focused file in the Explorer. |
| **Up / Down** | Move between focused Explorer rows; in the terminal, recall command history. |
| **Drag a divider** | Resize adjacent panels. Double-click a divider to restore its default size; focus it and use arrow keys for keyboard resizing. |

### Markdown and terminal

| Shortcut | Action |
| --- | --- |
| **Ctrl+I** | Italicize selected text in the Markdown editor. |
| **Enter** in Markdown search | Go to the next match; use **Shift+Enter** for the previous match. |
| **Enter** in terminal | Run the command. **Up / Down** recalls command history. |
| **Esc** | Close the active in-file search bar or media viewer. |

## Preferences

Open **Application settings** from the activity bar or workspace toolbar. Changes are saved automatically; **Save now** applies them immediately.

- **General:** choose Dark or Light theme, an accent color, and interface zoom.
- **Editor:** set code font size and toggle long-line wrapping.
- **Files:** enable or disable source-file auto-save and choose its delay.
- **Workspace:** adjust sidebar width and terminal panel height, or reset the panel layout. This tab also shows a compact shortcut list.

## Demo project

Open the included [Coral Studio Demo](Coral-Studio-Demo/README.md) folder as a project. It contains a four-page sample site and demonstrates pages, Markdown content, templates, and the build/preview workflow. Build it in Coral Studio, then use Preview to browse the generated pages.

## Run Coral Studio from source

From the application folder, install dependencies and start the app:

```powershell
npm install
npm start
```

The start command builds Monaco’s local editor and language-worker files before opening the application. The code editor does not need a CDN connection.

## About Coral Studio

Coral Studio keeps the static-site workflow together: edit project files, organize content and media, build the site, and review the generated pages. Projects remain ordinary folders that can also be managed with other tools.

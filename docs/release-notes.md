# Release notes

## 0.6.2

- Clicking a #tag in a note opens the SEARCH tab with that tag.
- While a binder tab is open, the MD view is dimmed; clicking it still closes the tab.

## 0.6.1

- Folder picker: works when no vault is registered; the VAULTS tab opens by default when the list is empty; spinner until the folder dialog appears.
- Layout: binder tabs use Times New Roman, 11px, uppercase display; panel borders 2px; the selected vault row no longer has a border; collapsing via a tab click or the MD area.
- Graph stays inside the tab height.

## 0.6.0

- Sidebar tabs VAULTS, SEARCH and NOTES; tabs slide in from the right over a note graph. Clicking an open tab or the MD area collapses the panel.
- Note graph built from [[links]]; clicking a node opens the note.
- Tag clicks run a search; wikilinks open the linked note.
- Edit in Obsidian for registered vaults, with a clear message when the vault is not registered.
- Store images and screenshots updated.

## 0.5.2

- Remove unused code (`getLang`).

## 0.5.1

- Bigger checkboxes with an accent color.
- Remove unused CSS and a debug log line.
- Docs: todo, development guide, and README known limits updated.

## 0.5.0

- Read Markdown: tables, highlighted code blocks (JSON, JavaScript, Java, SQL and common keywords), `#tags` as pills.
- Checkboxes shown as real boxes; numbered lists; line breaks kept.
- Right-click folders to create a new folder or a new `.md` note; names are checked and existing items are not overwritten.
- Ctrl+H shows help; F2 changes the language (remembered).
- Vaults and Notes headings stay in English in every language.
- Fix: table parsing no longer uses a backtracking-prone regex.
- Store images and README updated; support section added.

## 0.1.0

- Add vaults by folder path; remove them from the list (files are kept).
- Browse folders and notes in a Windows-Explorer-style tree.
- Read notes: headings, lists, checkboxes, tables, highlighted code blocks, bold, italic, inline code, `[[wikilinks]]`, `#tags`. Front matter is hidden.
- Create a new folder or a `.md` note by right-clicking a folder.
- Show whether Obsidian is installed.
- Seven UI languages; F2 changes the language, Ctrl+H shows help.

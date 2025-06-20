import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let panel: vscode.WebviewPanel | undefined;
  let currentDocument: vscode.TextDocument| undefined;

  const updateWebview = (doc: vscode.TextDocument) => {
    const ext = doc.languageId;
    if (ext !== 'css' && ext !== 'less') return;

    const text = doc.getText();

    const rootRegex = /[\w\d\s-\[\]\=]*:root(?:[.\w-]*)?\s*{([^}]+)}/g; ///:root(?:[.\w-]*)?\s*{([^}]+)}/g;
    const variableRegex = /--([\w-]+)\s*:\s*([^;]+);/g;

    const variableMap: Map<string, Map<string, string>> = new Map();
    const flatVariableMap: Map<string, Map<string, string>> = new Map();

    let match;
    while ((match = rootRegex.exec(text)) !== null) {
      const selectorMatch = match[0].match(/[\w\d\s-\[\]\=]*:root(?:[.\w-]*)?/);
      const selector = selectorMatch ? selectorMatch[0] : ':root';
      const body = match[1];

      let varMatch;
      while ((varMatch = variableRegex.exec(body)) !== null) {
        const varName = `--${varMatch[1]}`;
        const varValue = varMatch[2].trim();

        if (!variableMap.has(varName)) variableMap.set(varName, new Map());
        variableMap.get(varName)?.set(selector, varValue);

        if (!flatVariableMap.has(selector)) flatVariableMap.set(selector, new Map());
        flatVariableMap.get(selector)?.set(varName, varValue);
      }
    }

    const getVarValue = (selector: string, varName: string): string | undefined =>
      flatVariableMap.get(selector)?.get(varName) ??
      flatVariableMap.get(':root')?.get(varName);

    const resolveValue = (value: string, selector: string, depth = 0): string | null => {
      if (depth > 10) return null;
      const varMatch = value.match(/^var\(([^)]+)\)$/);
      if (!varMatch) return value;

      const [name, fallback] = varMatch[1].split(',').map(s => s.trim());
      if (!name.startsWith('--')) return fallback ?? null;

      const val = getVarValue(selector, name) ?? fallback;
      if (!val) return null;

      return resolveValue(val, selector, depth + 1);
    };

    const isColor = (val: string): boolean => {
      // Basic regex for hex, rgb(a), hsl(a), and named colors
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)
        || /^rgb(a)?\(/i.test(val)
        || /^hsl(a)?\(/i.test(val)
        || /^[a-z]+$/i.test(val);
    };

    const selectors = Array.from(new Set(
      Array.from(variableMap.values()).flatMap(map => Array.from(map.keys()))
    ));

    const header = `<tr><th>Variable</th>${selectors.map(s => `<th>${s.trimStart().trimEnd()}</th>`).join('')}</tr>`;

    const rows = Array.from(variableMap.entries()).map(([varName, contextMap]) => {
      const cells = selectors.map(selector => {
        const rawVal = contextMap.get(selector) ?? '';
        const resolvedVal = resolveValue(rawVal, selector);
        const showColor = resolvedVal && isColor(resolvedVal);

        const colorSwatch = showColor
          ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${resolvedVal};border:1px solid #ccc;margin-right:6px;"></span>`
          : '';

        const detail = resolvedVal && resolvedVal !== rawVal ? ` <small style="opacity: 0.7;">(résolu : ${resolvedVal})</small>` : '';

        return `<td class="vardetail">${rawVal ? `${colorSwatch}${rawVal}${detail}` : ''}</td>`;
      }).join('');
      return `<tr data-var="${varName}"><td><code>${varName}</code></td>${cells}</tr>`;
    }).join('\n');

    const html = `
      <html>
      <body style="font-family: sans-serif; padding: 1rem; background: #1e1e1e; color: white;">
        <h2>Variables CSS par contexte</h2>
		<input id="search" type="text" placeholder="Filtrer une variable..." 
			style="margin-bottom: 1rem; padding: 0.5rem; width: 100%; font-size: 1rem; border-radius: 4px;" />
        <table id="varTable" border="1" style="border-collapse: collapse; width: 100%; text-align: left;">
          <thead style="background: #333;">${header}</thead>
          <tbody>${rows}</tbody>
        </table>
        <style>
          code {
            color: white;
          }
          .highlight {
            background-color: #005f87 !important;
          }
			tbody td.vardetail:hover {
					background-color: #005f87 !important;
					cursor: pointer;
			}
        </style>
        <script>
          const vscode = acquireVsCodeApi();

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'highlightVariable') {
              const varName = message.varName;
              const rows = document.querySelectorAll('#varTable tbody tr');
              rows.forEach(row => row.classList.remove('highlight'));
              let foundRow = null;
              rows.forEach(row => {
                const codeCell = row.querySelector('td code');
                if (codeCell && codeCell.textContent === varName) {
                  row.classList.add('highlight');
                  foundRow = row;
                }
              });
              if (foundRow) {
                foundRow.scrollIntoView({behavior: 'smooth', block: 'center'});
              }
            }
          });

			const filterInput = document.getElementById('search');
			filterInput.addEventListener('input', () => {
				const filter = filterInput.value.toLowerCase();
				document.querySelectorAll('tbody tr').forEach(tr => {
				const varName = tr.getAttribute('data-var')?.toLowerCase() || '';
				tr.style.display = varName.includes(filter) ? '' : 'none';
				});
			});

		  function log(...args) {
		  	vscode.postMessage({ type: 'log', message: [...args].join('') });
		  }

          // Remove highlight if clicked outside table rows
          document.body.addEventListener('click', event => {
              document.querySelectorAll('#varTable tbody tr.highlight').forEach(row => row.classList.remove('highlight'));
          });

		  document.querySelectorAll('tbody td.vardetail').forEach(cell => {
		  	cell.addEventListener('click', (e) => {
			const cell = event.target.closest('td,th');
			if (!cell) {
			return;
			}

			//ici
			const row = cell.parentElement;
			const table = row.closest('table');
			const rowIndex = row.rowIndex;
			const cellIndex = cell.cellIndex;

			// Récupère la première cellule de la ligne (nom de la variable)
			const variableName = row.cells[0].textContent.trim();

			// Récupère l'en-tête de la colonne
			const header = table.rows[0].cells[cellIndex].textContent.trim();

			vscode.postMessage({ type: 'rotomecacellclick', message: {header, variableName} });
			});
		  });
        </script>
      </body>
      </html>
    `;

    if (panel) {
      panel.webview.html = html;
    }
  };

  // Command to show variables panel
  let disposable = vscode.commands.registerCommand('cssVariableViewer.showVariables', () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) return;

	currentDocument = editor.document;

    const doc = editor.document;
    const ext = doc.languageId;
    if (ext !== 'css' && ext !== 'less') {
      vscode.window.showInformationMessage('Ce fichier n\'est ni CSS ni LESS.');
      return;
    }

    if (!panel) {
      panel = vscode.window.createWebviewPanel(
        'cssVariables',
        'Variables CSS dans :root',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );
      panel.onDidDispose(() => {
        panel = undefined;
      });
    }
	panel.webview.onDidReceiveMessage(message => {
		if (!panel) return;

		if (message.type === 'rotomecacellclick') {
			const variableName = `${message.message.variableName}:`; // e.g. --main-color
			const rootSelector = message.message.header; // e.g. :root or :root[data-theme="dark"]
			const editor = vscode.window.visibleTextEditors.find(x => x.document === currentDocument);
			
			if (!editor) return;
			
			const document = editor.document;
			const text = document.getText();
			const lines = text.split('\n');

			let inRoot = false;
			let rootStartLine = -1;
			let rootEndLine = -1;

			// Trouver le bloc :root correspondant
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].includes(rootSelector)) {
					inRoot = true;
					rootStartLine = i;
				}
				if (inRoot && lines[i].includes('}')) {
					rootEndLine = i;
					break;
				}
			}

			let variableLine = -1;
			if (rootStartLine !== -1 && rootEndLine !== -1) {
				for (let i = rootStartLine; i <= rootEndLine; i++) {
					if (lines[i].includes(variableName)) {
						variableLine = i;
						break;
					}
				}
			}

			if (variableLine !== -1) {
			const lineText = document.lineAt(variableLine).text;

			editor.selection = new vscode.Selection(
				variableLine, 0,
				variableLine, lineText.length
			);

			editor.revealRange(
				new vscode.Range(variableLine, 0, variableLine, lineText.length),
				vscode.TextEditorRevealType.InCenter
			);
			}
		}

	});
    updateWebview(doc);
    panel.reveal();
  });

  // Listen for document changes to update panel content
  vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document === vscode.window.activeTextEditor?.document) {
		currentDocument = event.document;
		updateWebview(event.document);
    }
  });

  // Listen to editor selection changes to detect double-click on a variable
  const higlight = (event: {textEditor:vscode.TextEditor}) => {
	// const a = 0;
	// if (!panel) vscode.commands.executeCommand('cssVariableViewer.showVariables');
	// if (!panel) return;
    if (!event.textEditor || !event.textEditor.selections.length) return;
    const selection = event.textEditor.selections[0];
   // if (selection.isEmpty) return; // no selection
    const lineNumber = selection.active.line; // Numéro de la ligne sélectionnée (0-based)
    const lineText = event.textEditor.document.lineAt(lineNumber).text; // Contenu de la ligne

    // Vérifie si la sélection est une variable CSS (ex: --my-var)
    if (/--[\w-]+\s?:/.test(lineText)) {
      // Ouvre le panel s'il n'est pas ouvert
	  vscode.commands.executeCommand('cssVariableViewer.showVariables');
      if (!panel) {
        // Crée et met à jour, mais on a déjà return si panel undefined
        return;
      }
      panel.reveal();

      // Envoie un message au webview pour surligner la variable sélectionnée
      panel.webview.postMessage({
        command: 'highlightVariable',
        varName: /--[\w-]+\s?:/.exec(lineText)?.[0]?.replaceAll?.(':', '') ?? ''
      });
    } else {
	if (!panel) return;
      // Si sélection autre chose, enlever surlignage
      panel.webview.postMessage({
        command: 'highlightVariable',
        varName: null
      });
    }
  };
  

vscode.window.onDidChangeTextEditorSelection(event => {
    if (!event.textEditor || !event.selections.length) return;
    const selection = event.selections[0];

    if (!selection) return;

    const start = selection.start;
    const lineNumber = start.line; // Numéro de la ligne sélectionnée (0-based)
    const lineText = lineNumber === -1 ? '' : event.textEditor.document.lineAt(lineNumber).text; // Contenu de la ligne

    // Vérifie si la sélection est une variable CSS (ex: --my-var)
	vscode.commands.executeCommand(
    'setContext',
    'cssVariableViewer.hasCssVar',
    /--[\w-]+\s?:/.test(lineText)
  );
	
});

  context.subscriptions.push(disposable);

	context.subscriptions.push(
	vscode.commands.registerCommand('cssVariableViewer.focusVariable', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		higlight({textEditor:editor});
	})
	);
}

export function deactivate() {}

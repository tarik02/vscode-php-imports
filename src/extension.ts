import * as PhpImports from 'php-imports'
import * as vscode from 'vscode'


export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-php-imports.format', async () => {
			const editor = vscode.window.activeTextEditor

			if (!editor) {
				return
			}

			await formatImportsInEditorWithFeedback(editor)
		}),

		vscode.workspace.onWillSaveTextDocument(event => {
			if (!(
				event.document.languageId === 'php' &&
				vscode.workspace.getConfiguration('php-imports').get('formatOnSave')
			)) {
				return
			}

			event.waitUntil((async () => {
				const edit = await prepareEditForDocument(event.document, detectIndent(event.document.getText()) ?? '    ')

				if (!edit) {
					return []
				}

				return [
					vscode.TextEdit.replace(
						new vscode.Range(
							event.document.positionAt(edit.start),
							event.document.positionAt(edit.end),
						),
						edit.replacement,
					),
				]
			})())
		}),
	)
}

export function deactivate(): void {
	//
}

async function formatImportsInEditorWithFeedback(editor: vscode.TextEditor): Promise<void> {
	try {
		if (await formatImportsInEditor(editor)) {
			vscode.window.showInformationMessage('Imports successfully formatted')
		} else {
			vscode.window.showInformationMessage('Imports are already formatted')
		}
	} catch (err) {
		console.error(err)

		vscode.window.showErrorMessage('Failed to format imports')
	}
}

async function formatImportsInEditor(editor: vscode.TextEditor): Promise<boolean> {
	const indent = editor.options.insertSpaces
		? ' '.repeat(editor.options.tabSize as number)
		: '\t'

	const edit = await prepareEditForDocument(editor.document, indent)

	if (!edit) {
		return false
	}

	return await editor.edit(builder => {
		builder.replace(
			new vscode.Range(
				editor.document.positionAt(edit.start),
				editor.document.positionAt(edit.end),
			),
			edit.replacement,
		)
	})
}

async function prepareEditForDocument(editorDocument: vscode.TextDocument, indent: string): Promise<{ start: number, end: number, replacement: string } | undefined> {
	const configuration = vscode.workspace.getConfiguration('php-imports')
	const text = editorDocument.getText()

	const document = PhpImports.Grammar.fromSource(text)

	const flat = PhpImports.Flat.fromGrammar(document.uses)

	if (flat.length === 0) {
		return undefined
	}

	const tree = PhpImports.Tree.fromFlat(flat)

	const grouped = PhpImports.Group.create()

	if (configuration.get('psr12.enable')) {
		PhpImports.Group.collectPsr12(tree, grouped, {
			minNestedGroupNestedUsesCount: configuration.get('psr12.minNestedGroupNestedUsesCount'),
			minNestedGroupUsesCount: configuration.get('psr12.minNestedGroupUsesCount'),
			minGroupUsesCount: configuration.get('psr12.minGroupUsesCount'),
			isolateModifiers: configuration.get('psr12.isolateModifiers'),
		})
	}

	if (configuration.get('custom.enable')) {
		PhpImports.Group.collectCustom(tree, grouped, {
			include: configuration.get('custom.include'),
			exclude: configuration.get('custom.exclude'),
		})
	}

	PhpImports.Group.collectAllToSingles(tree, grouped)

	PhpImports.Group.sort(grouped, {
		order: configuration.get('sort.order'),
		nestedOrder: configuration.get('sort.nestedOrder'),
	})

	const printed = PhpImports.Print.print(grouped, {
		order: configuration.get('order'),
		indent,
	})

	const prefix = text.substring(0, document.uses.location.start.offset)
	const suffix = text.substring(document.uses.location.end.offset)

	const startOffset = document.uses.location.start.offset - (prefix.length - prefix.trimEnd().length)
	const endOffset = document.uses.location.end.offset + (suffix.length - suffix.trimStart().length)

	const emptyLinesAfterImports = configuration.get<number>('print.emptyLinesAfterImports', 1)

	const replacement = `\n\n${printed}\n` + '\n'.repeat(emptyLinesAfterImports)

	if (text.substring(startOffset, endOffset) === replacement) {
		return undefined
	}

	return {
		start: startOffset,
		end: endOffset,
		replacement,
	}
}

function detectIndent(source: string): string | undefined {
	const re = /^([\t ]+)(private|public|protected)/gm
	const indents: Record<string, number> = {}

	let match
	while ((match = re.exec(source)) !== null) {
		indents[match[1]] = (indents[match[1]] ?? 0) + 1
	}

	let maxCount = 0
	let maxIndent = undefined

	for (const [indent, count] of Object.entries(indents)) {
		if (count > maxCount) {
			maxCount = count
			maxIndent = indent
		}
	}

	return maxIndent
}

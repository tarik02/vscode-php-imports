import * as multimatch from 'multimatch'
import * as path from 'path'
import * as PhpImports from 'php-imports'
import { TextDecoder, TextEncoder } from 'util'
import * as vscode from 'vscode'


export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-php-imports.init', async () => {
			const activeDocumentUri = vscode.window.activeTextEditor?.document.uri

			const workspaceFolder = (activeDocumentUri
				? vscode.workspace.getWorkspaceFolder(activeDocumentUri) ?? vscode.workspace.workspaceFolders?.[0]
				: vscode.workspace.workspaceFolders?.[0]
			)

			if (workspaceFolder === undefined) {
				vscode.window.showErrorMessage('There is no open project')
				return
			}

			const rcFileUri = vscode.Uri.joinPath(workspaceFolder.uri, '.phpimportsrc')

			try {
				await vscode.workspace.fs.stat(rcFileUri)

				vscode.window.showErrorMessage('File .phpimportsrc already exists')

				await vscode.window.showTextDocument(
					await vscode.workspace.openTextDocument(rcFileUri),
				)

				return
			} catch (e) {
				if (! (e instanceof vscode.FileSystemError && e.code === 'FileNotFound')) {
					throw e
				}
			}

			const phpImportsRc = {
				...PhpImports.PhpImportsRc.encode(createConfigurationFromVscodeSettings()),
				root: '.',
			}

			await vscode.workspace.fs.writeFile(
				rcFileUri,
				(new TextEncoder()).encode(
					JSON.stringify(
						phpImportsRc,
						undefined,
						4,
					),
				),
			)

			vscode.window.showInformationMessage('File .phpimportsrc successfully created')

			await vscode.window.showTextDocument(
				await vscode.workspace.openTextDocument(rcFileUri),
			)
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-php-imports.format', async () => {
			const editor = vscode.window.activeTextEditor

			if (!editor) {
				return
			}

			await formatImportsInEditor(editor)
		}),

		vscode.workspace.onWillSaveTextDocument(event => {
			if (!(
				event.document.languageId === 'php' &&
				vscode.workspace.getConfiguration('php-imports').get('formatOnSave')
			)) {
				return
			}

			event.waitUntil((async () => {
				const edit = await prepareEditForDocument(event.document)

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

async function formatImportsInEditor(editor: vscode.TextEditor): Promise<void> {
	const indent = editor.options.insertSpaces
		? ' '.repeat(editor.options.tabSize as number)
		: '\t'

	const edit = await prepareEditForDocument(editor.document, indent, true)

	if (!edit) {
		return
	}

	const status = await editor.edit(builder => {
		builder.replace(
			new vscode.Range(
				editor.document.positionAt(edit.start),
				editor.document.positionAt(edit.end),
			),
			edit.replacement,
		)
	})

	if (status) {
		await vscode.window.showInformationMessage('Imports successfully formatted')
	}
}

async function createConfigurationFromWorkspace(
	fileUri: vscode.Uri | undefined = undefined,
): Promise<PhpImports.PhpImportsRc | undefined> {
	const foldersToCheck = []

	if (fileUri !== undefined) {
		const folder = vscode.workspace.getWorkspaceFolder(fileUri)
		if (folder !== undefined) {
			foldersToCheck.push(folder)
		}
	} else {
		foldersToCheck.push(...(vscode.workspace.workspaceFolders ?? []))
	}

	for (const folder of foldersToCheck) {
		try {
			const rc = PhpImports.parseRcFromObject(
				JSON.parse(
					(new TextDecoder('utf-8')).decode(
						await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, '.phpimportsrc')),
					),
				),
			)

			return {
				...rc,
				root: path.resolve(folder.uri.path, rc.root),
			}
		} catch (e) {
			if (e instanceof vscode.FileSystemError && e.code === 'FileNotFound') {
				continue
			}

			throw e
		}
	}

	return undefined
}

function createConfigurationFromVscodeSettings(fileUri: vscode.Uri | undefined = undefined): PhpImports.PhpImportsRc {
	const configuration = vscode.workspace.getConfiguration('php-imports')

	const foldersToCheck = []

	if (fileUri !== undefined) {
		const folder = vscode.workspace.getWorkspaceFolder(fileUri)
		if (folder !== undefined) {
			foldersToCheck.push(folder)
		}
	} else {
		foldersToCheck.push(...(vscode.workspace.workspaceFolders ?? []))
	}

	return PhpImports.parseRcFromObject({
		root: foldersToCheck[0]?.uri.path,

		include: [
			'**/*.php',
		],

		order: configuration.get('order'),

		sort: {
			order: configuration.get('sort.order'),
			nestedOrder: configuration.get('sort.nestedOrder'),
		},

		print: {
			emptyLinesAfterImports: configuration.get<number>('print.emptyLinesAfterImports', 1),
		},

		psr12: {
			enable: configuration.get('psr12.enable'),
			isolateModifiers: configuration.get('psr12.isolateModifiers'),
			minNestedGroupNestedUsesCount: configuration.get('psr12.minNestedGroupNestedUsesCount'),
			minNestedGroupUsesCount: configuration.get('psr12.minNestedGroupUsesCount'),
			minGroupUsesCount: configuration.get('psr12.minGroupUsesCount'),
		},

		custom: {
			enable: configuration.get('custom.enable'),
			isolateModifiers: configuration.get('custom.isolateModifiers'),
			include: configuration.get('custom.include'),
			exclude: configuration.get('custom.exclude'),
		},

		unused: {
			enable: configuration.get('unused.enable'),
		},
	} as Partial<PhpImports.PhpImportsRc>)
}

async function prepareEditForDocument(
	editorDocument: vscode.TextDocument,
	indent: string | undefined = undefined,
	withFeedback = false,
): Promise<{ start: number, end: number, replacement: string } | undefined> {
	try {
		const text = editorDocument.getText()

		let configuration: PhpImports.PhpImportsRc | undefined

		try {
			configuration = await createConfigurationFromWorkspace(editorDocument.uri)
		} catch (e) {
			console.error(e)
			vscode.window.showErrorMessage('Failed to read .phpimportsrc file')
		}

		configuration = configuration ?? createConfigurationFromVscodeSettings(editorDocument.uri)

		if (
			multimatch(
				path.relative(configuration.root, editorDocument.uri.path),
				[
					...configuration.include,
					...configuration.exclude.map(it => '!' + it),
					...configuration.exclude.map(it => '!' + it + '/**/*'),
					...configuration.exclude.map(it => (it.startsWith('/')
						? '!' + path.relative(configuration!.root, it.substring(1))
						: '!**/' + it
					)),
					...configuration.exclude.map(it => (it.startsWith('/')
						? '!' + path.relative(configuration!.root, it.substring(1))
						: '!**/' + it + '/**/*'
					)),
				],
			).length === 0
		) {
			if (withFeedback) {
				vscode.window.showWarningMessage('This file is ignored with .phpimportsrc')
			}

			return undefined
		}

		const result = PhpImports.processText(
			text,
			configuration,
			indent,
		)

		if (withFeedback && result === undefined) {
			vscode.window.showInformationMessage('Imports are already formatted')
		}

		return result
	} catch (err) {
		console.error(err)

		vscode.window.showErrorMessage('Failed to format imports: ' + err)
	}
}

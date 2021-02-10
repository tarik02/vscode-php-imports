# vscode-php-imports

PHP imports formatter for Visual Studio Code.

## Commands

* `vscode-php-imports.format`: PHP Imports: Format

## Extension Settings

* `php-imports.formatOnSave`: Automatically format imports before saving PHP file.
* `php-imports.order`: Order of import sets and empty lines between them. An array of enums with possible values:
	- `emptyLine`
	- `all.all`
	- `all.class`
	- `all.function`
	- `all.const`
	- `singleUses.all`
	- `singleUses.class`
	- `singleUses.function`
	- `singleUses.const`
	- `groupedUses.all`
	- `groupedUses.class`
	- `groupedUses.function`
	- `groupedUses.const`
* `php-imports.sort.order`: Order of first-level imports. Possible values: `default` (alphabetical) or `natural` (first longest, alphabetical).
* `php-imports.sort.nestedOrder`: Order of second-level imports. Possible values: `default` (alphabetical) or `natural` (first longest, alphabetical).
* `php-imports.print.emptyLinesAfterImports`: Count of empty lines between last import and the declaration after it.
* `php-imports.psr12.enable`: Enable PSR-12 imports formatting.
* `php-imports.psr12.isolateModifiers`: Whether to put different modifiers (without modifier, const and function) to different groups.
* `php-imports.psr12.minNestedGroupNestedUsesCount`: Minimum count of nested uses to make a nested group with them.
* `php-imports.psr12.minNestedGroupUsesCount`: Mimimum count of uses to make a nested group with them.
* `php-imports.psr12.minGroupUsesCount`: Mimimum count of uses of same namespace to make a group with them.
* `php-imports.custom.enable`: Enable custom imports formatting
* `php-imports.custom.isolateModifiers`: Whether to put different modifiers (without modifier, const and function) to different groups.
* `php-imports.custom.include`: A list of namespaces that should always be grouped. Can be used with wildcards (*) and double wildcards (**).
* `php-imports.custom.exclude`: A list of namespaces that should never be grouped.

## Release Notes

### 0.1.3

* Fix issue when there is namespace and use with the same name and parent

### 0.1.2

* Fixed indents detection
* Activate extension when php file is opened
* Update php-imports library

### 0.1.1

* Detect file indentation when formatting before saving

### 0.1.0

* Initial release

## License

The project is released under the MIT license. Read the [license](https://github.com/Tarik02/vscode-php-imports/blob/master/LICENSE) for more information.

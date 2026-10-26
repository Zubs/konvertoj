Output docs/demo.gif
Output docs/demo.txt

Require node

Set Shell bash
Set FontSize 18
Set Width 1100
Set Height 600
Set Theme "Catppuccin Mocha"
Set TypingSpeed 50ms

Hide
Type `alias konvertoj="node $PWD/dist/cli.js"` Enter
Type "demo=$(mktemp -d) && cp test/fixtures/iphone.heic $demo/holiday.heic && cd $demo && clear" Enter
Show

Type "konvertoj -m heictojpg holiday.heic" Sleep 500ms Enter
Sleep 3s
Type "konvertoj -m heictopng holiday.heic" Sleep 500ms Enter
Sleep 3s
Type "konvertoj -m compress holiday.png -o small" Sleep 500ms Enter
Sleep 3s
Type "konvertoj --list-modes | head -8" Sleep 500ms Enter
Sleep 4s

Hide
Type "cd - && rm -rf $demo" Enter

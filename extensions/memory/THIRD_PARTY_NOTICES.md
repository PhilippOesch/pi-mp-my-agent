# Third-party notices

This extension is an independent, clean-room reimplementation of the memory
feature set of [pi-memory](https://github.com/jayzeng/pi-memory), originally
created by Jay Zeng. It was written from the documented behavior and public
description of that project; the source was not copied as a whole.

Parts of the observable interface were intentionally kept compatible with
`pi-memory` so that existing memory data and existing prompts continue to
work. The following elements reproduce `pi-memory` behavior verbatim:

- The entry marker format and the entry-boundary regular expression
  (`<!-- {timestamp} [{session}] -->`, `<!-- last updated: ... -->`,
  `<!-- HANDOFF ... -->`).
- The exit-summary system prompt and the `## Session Summary (auto, exit: ...)`
  heading wrapper.
- The guidance block prepended to the injected memory context, including the
  `#tags` and `[[links]]` conventions.

`pi-memory` is distributed under the MIT License, reproduced below.

---

## pi-memory

MIT License

Copyright (c) 2026 Jay Zeng

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

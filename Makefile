# tools
ESBUILD = esbuild
NPM     = npm
SASSC   = sassc
TSC     = tsc

# flags
tsflags = \
	--noErrorTruncation \
	--noUnusedParameters \
	--strict \
	--target es6 \
	$(TSFLAGS)
esflags = \
	--minify \
	$(ESFLAGS)
sassflags = \
	--style compressed \
	$(SASSFLAGS)

fontfiles = \
	build/fonts/OpenSans-Regular.ttf \
	build/fonts/OpenSans-Bold.ttf \
	build/fonts/OpenSans-Italic.ttf \
	build/fonts/OpenSans-BoldItalic.ttf

all: build/index.xhtml build/style.css build/script.js $(fontfiles)

clean:
	$(RM) -r build work
distclean: clean
	$(RM) -r node_modules package-lock.json

build/index.xhtml: index.xhtml
	install -Dm 644 $(@F) $@

build/style.css: style.sass
	install -d $(@D)
	$(SASSC) $(sassflags) --sass $(@F:.css=.sass) $@

build/script.js: work/script.js work/pdf.js
	$(ESBUILD) $(esflags) --bundle --platform=browser --outfile=$@ work/script.js
work/script.js: script.ts package-lock.json
	$(TSC) $(tsflags) --outDir $(@D) $(@F:.js=.ts) || { $(RM) $@; false; }
work/pdf.js: pdf.ts package-lock.json
	$(TSC) $(tsflags) --module CommonJS --outDir $(@D) $(@F:.js=.ts) || { $(RM) $@; false; }

build/fonts/%: fonts/%
	install -Dm 644 fonts/$(@F) $@

package-lock.json: package.json
	$(NPM) install --ignore-scripts .

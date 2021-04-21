import {
	formatUnit,
	isOrderInfo,
	Order,
	OrderArticle,
	OrderInfo,
} from "./pdf";

declare global {
	interface String {
		normalize(): string;
	}
	interface Date {
		iso8601Date(): string;
		iso8601Time(): string;
		iso8601():     string;
	}
}
String.prototype.normalize = function(): string {
	return this
		.replace(/\s+/g, " ")
		.replace(/^ /, "")
		.replace(/ $/, "");
};
Date.prototype.iso8601Date = function(): string {
	return `${
		String(this.getFullYear()).lpad(4, "0")
	}-${
		String(this.getMonth() + 1).lpad(2, "0")
	}-${
		String(this.getDate()).lpad(2, "0")
	}`;
};
Date.prototype.iso8601Time = function(): string {
	return `${
		String(this.getHours()).lpad(2, "0")
	}:${
		String(this.getMinutes() + 1).lpad(2, "0")
	}:${
		String(this.getSeconds()).lpad(2, "0")
	},${
		String(this.getMilliseconds()).lpad(3, "0")
	}`;
};
Date.prototype.iso8601 = function(): string {
	return `${this.iso8601Date()} ${this.iso8601Time()}`;
};

const log = (() => {
	const records: string[] = [];
	let logContainer: HTMLElement|null = null;
	let logShow: HTMLInputElement|null = null;
	const print = (msg: string) => {
		logContainer
			?.appendChild(document.createElement("li"))
			?.appendChild(document.createTextNode(msg));
		logShow = logShow || document.querySelector("#showLog");
		logShow ? logShow.checked = true : false;
	};
	return (msg: string): void => {
		const now = `[${new Date().iso8601()}]`;
		console.log(now, msg);
		msg = `${now} ${msg}`;
		if(!logContainer) {
			logContainer = document.querySelector("#log");
			if(logContainer) {
				records.forEach(print);
				records.splice(0, records.length);
			} else {
				records.push(msg);
			}
		}
		if(logContainer) {
			print(msg);
		}
	};
})();

const domContentLoaded: Promise<void> = new Promise((resolve, _) => {
	document.addEventListener("DOMContentLoaded", _ => {
		console.log("DOMContentLoaded fired");
		resolve();
	});
});

class OrderTable {
	private category: string|HTMLTableDataCellElement;

	static mktd(cls: string, child?: string|HTMLElement): HTMLTableDataCellElement {
		const td: HTMLTableDataCellElement = document.createElement("td");
		td.setAttribute("class", cls);
		if(child) {
			td.appendChild(
				typeof child == "string"
					? document.createTextNode(child)
					: child
			);
		}
		return td;
	}

	constructor(readonly root: HTMLTableSectionElement) {
		this.category = "Kategorie";
	}

	setCategory(category: string): void {
		this.category = category;
	}

	addRow(...tds: HTMLElement[]): HTMLTableRowElement {
		const tr: HTMLTableRowElement = document.createElement("tr");
		if(typeof this.category == "string") {
			const e = document.createElement("div");
			e.appendChild(document.createTextNode(this.category));
			this.category = tr.appendChild(OrderTable.mktd("category", e));
			tr.setAttribute("class", "first");
		}
		tds.forEach(e => tr.appendChild(e));
		this.root.appendChild(tr);
		const rowspan = parseInt(this.category.getAttribute("rowspan") || "0");
		this.category.setAttribute("rowspan", String(rowspan + 1));
		return tr;
	}

	addArticle(a: Article): void {
		const input = document.createElement("input");
		input.setAttribute("type", "number");
		input.setAttribute("min",  "0");
		if(Math.random() < 0.5) {
			input.setAttribute("value", "1");
		}
		this.addRow(
			OrderTable.mktd("articleno", a.id),
			OrderTable.mktd("article",   a.name),
			OrderTable.mktd("unit",      a.unit),
			OrderTable.mktd("count",     input),
		);
	}

	static getCellText(td: HTMLElement): string {
		const input = td.querySelector("input");
		if(input) {
			return (input as HTMLInputElement).value || "";
		} else {
			return td.textContent || "";
		}
	}

	getOrder(): OrderArticle[] {
		const articles = [];
		for(const row of this.root.rows) {
			const tds = Array.from(row.querySelectorAll("td"));
			if(tds.length > 0 && tds[0].hasAttribute("rowspan")) {
				tds.shift();
			}
			if(tds.length < 4) {
				continue;
			}
			const [id, name, unit, count] = Array.from(tds).slice(0, 4).map(OrderTable.getCellText);
			if(name.match(/^\s*$/) || count.match(/^(\s|0)*$/)) {
				continue;
			}
			articles.push({id: id, name: name, unit: unit, count: count});
		}
		return articles;
	}
}

type DocumentStuff = {
	date:  HTMLInputElement,
	form:  HTMLFormElement;
	table: OrderTable;
}

function guessDate(): string {
	const now = new Date();
	let   ms  = now.getTime();
	ms += 86400 * 1000;
	if(now.getHours() >= 14) {
		ms += 86400 * 1000;
	}
	now.setTime(ms);
	return now.iso8601Date();
}

async function parseDocument(): Promise<DocumentStuff> {
	await domContentLoaded;

	const date = <HTMLInputElement|null>document.querySelector("#deliveryDate");
	if(!date) {
		throw "cannot find delivery date picker";
	}
	date.value = guessDate();
	log(`guessed delivery date: ${date.value}`);

	const form = document.querySelector("form");
	if(!form) {
		throw "cannot find order form";
	}

	const table = form.querySelector("tbody");
	if(!table) {
		throw "cannot find order table";
	}

	return {
		date:  date,
		form:  form,
		table: new OrderTable(table as HTMLTableSectionElement),
	};
}

function fetchSomething(url: string, type: XMLHttpRequestResponseType): Promise<XMLHttpRequest> {
	return new Promise((resolve, reject) => {
		const r = new XMLHttpRequest();
		r.open("GET", url);
		r.responseType = type;
		r.onreadystatechange = () => {
			if(r.readyState == XMLHttpRequest.DONE) {
				if(r.status == 200) {
					log(`fetched ${url}`);
					resolve(r);
				} else {
					reject(`cannot load ${url}: HTTP ${r.status} error`);
				}
			}
		};
		r.send();
	});
}

async function fetchOrderInfo(): Promise<OrderInfo> {
	const r = await fetchSomething("/doku.php?do=export_code&id=gastro:bestellung:gelos&codeblock=0", "json");
	if(!isOrderInfo(r.response)) {
		throw `unexpected order info: ${JSON.stringify(r.response)}`;
	}
	return r.response;
}

function findTables(root: Document): Array<[string, HTMLTableElement]> {
	const tables: Array<[string, HTMLTableElement]> = [];
	for(const h of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
		const category = h.textContent?.normalize();
		if(category) {
			for(const table of h.nextElementSibling?.querySelectorAll("table") || []) {
				tables.push([category, table]);
			}
		}
	}
	return tables;
}

interface Article {
	id?:    string;
	name:   string;
	unit:   string;
	hint?:  string;
}

type Error = string|undefined;

function parseTable(table: HTMLTableElement): [Article[], Error] {
	const articles: Article[] = [];
	for(const row of table.rows) {
		const tds = Array.from(row.querySelectorAll("td"));
		if(tds.length == 1) {
			continue;
		} else if(tds.length != 4) {
			return [[], `cannot parse article: ${row.outerHTML}`];
		}
		const [id, name, unit, hint] = tds.map((e: HTMLElement|undefined) => e?.textContent?.normalize());
		if(!name) {
			return [[], `missing name: ${row.outerHTML}`];
		}
		if(!unit) {
			return [[], `missing unit: ${row.outerHTML}`];
		}
		articles.push({
			id:     id || undefined,
			name:   name,
			unit:   formatUnit(unit),
			hint:   hint || undefined,
		});
	}
	return [articles, undefined];
}

async function fetchArticles(): Promise<Array<[string, Article[]]>> {
	const r = await fetchSomething("/doku.php?id=gastro:bestellung:gelos&do=export_xhtmlbody", "document");
	if(!r.responseXML) {
		throw "cannot parse article list";
	}
	let articles: Array<[string, Article[]]> = [];
	for(const [category, table] of findTables(r.responseXML)) {
		const [more, err] = parseTable(<HTMLTableElement>table);
		if(err) {
			throw err;
		}
		articles.push([category, more]);
	}
	return articles;
}

(async () => {
	const [
		{date, form, table},
		orderInfo,
		allArticles,
	] = await Promise.all([
		parseDocument(),
		fetchOrderInfo(),
		fetchArticles(),
	]);
	log("using order info " + JSON.stringify(orderInfo));
	for(const [category, articles] of allArticles) {
		table.setCategory(category);
		for(const a of articles) {
			table.addArticle(a);
		}
	}

	let downloadLink: HTMLElement|null = null;
	form.addEventListener("submit", async (ev: Event) => {
		ev.preventDefault();

		log("creating new order...");
		const articles = table.getOrder();
		const order    = new Order(orderInfo, date.value)
		for(const article of articles) {
			order.add(article);
		}
		log(`added ${articles.length} articles`);

		const blob = await order.pdf();
		if(downloadLink) {
			URL.revokeObjectURL(downloadLink.getAttribute("href") as string);
			log("revoked old link");
		} else {
			downloadLink = document.createElement("a");
			downloadLink.appendChild(document.createTextNode("Download PDF"));
			form.appendChild(downloadLink);
			log("created download link");
		}
		downloadLink.setAttribute("href", URL.createObjectURL(blob));
		downloadLink.setAttribute("download", `gelos-${date.value}.pdf`);
		log(`new download link: ${downloadLink.getAttribute("href")}`);
	});
})().catch((e: string) => {
	log(e);
	alert(e);
});

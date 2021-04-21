/**
 * orderpdf
 * Copyright (C) 2021  schnusch
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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

async function promisedEvent(obj: EventTarget, event: string): Promise<Event> {
	return new Promise((resolve, _) => {
		const f = (ev: Event) => {
			obj.removeEventListener(event, f);
			resolve(ev);
		};
		obj.addEventListener(event, f);
	});
}

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

	clear(): void {
		while(this.root.firstChild) {
			this.root.removeChild(this.root.firstChild);
		}
	}

	addArticle(a: Article): void {
		const input = document.createElement("input");
		input.setAttribute("type", "number");
		input.setAttribute("min",  "0");
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

	getOrder(orderInfo: OrderInfo, date: string): Order {
		const order = new Order(orderInfo, date);
		const articles = [];
		let n = 0;
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
			order.add({id: id, name: name, unit: unit, count: count});
			n++;
		}
		log(`added ${n} articles`);
		return order;
	}
}

/**
 * Return the guessed delivery date as an ISO-8601 string.
 * If it this before 2:00 pm the next day is picked, otherwise the next but one.
 */
function guessDeliveryDate(): string {
	const now = new Date();
	let   ms  = now.getTime();
	ms += 86400 * 1000;
	if(now.getHours() >= 14) {
		ms += 86400 * 1000;
	}
	now.setTime(ms);
	return now.iso8601Date();
}

type DocumentStuff = {
	datePicker: HTMLInputElement,
	orderForm:  HTMLFormElement;
	orderTable: OrderTable;
	wikiSelect: HTMLSelectElement;
}

function getDocumentStuff(): DocumentStuff {
	const date = <HTMLInputElement|null>document.querySelector("#deliveryDate");
	if(!date) {
		throw "cannot find delivery date picker";
	}
	date.value = guessDeliveryDate();
	log(`guessed delivery date: ${date.value}`);

	const form = document.querySelector("form");
	if(!form) {
		throw "cannot find order form";
	}

	const select = document.querySelector("#wikiPage");
	if(!select) {
		throw "cannot find wiki page select";
	}

	const table = form.querySelector("tbody");
	if(!table) {
		throw "cannot find order table";
	}

	return {
		datePicker: date,
		orderForm:  form,
		orderTable: new OrderTable(table as HTMLTableSectionElement),
		wikiSelect: select as HTMLSelectElement,
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

async function fetchOrderInfo(url: string): Promise<OrderInfo> {
	const r = await fetchSomething(url, "json");
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

function parseTable(table: HTMLTableElement): Article[] {
	const articles: Article[] = [];
	for(const row of table.rows) {
		const tds = Array.from(row.querySelectorAll("td"));
		if(tds.length == 1) {
			continue;
		} else if(tds.length != 4) {
			throw `cannot parse article: ${row.outerHTML}`;
		}
		const [id, name, unit, hint] = tds.map((e: HTMLElement|undefined) => e?.textContent?.normalize());
		if(!name) {
			throw `missing name: ${row.outerHTML}`;
		}
		if(!unit) {
			throw `missing unit: ${row.outerHTML}`;
		}
		articles.push({
			id:     id || undefined,
			name:   name,
			unit:   formatUnit(unit),
			hint:   hint || undefined,
		});
	}
	return articles;
}

async function fetchArticles(url: string): Promise<Array<[string, Article[]]>> {
	const r = await fetchSomething(url, "document");
	if(!r.responseXML) {
		throw "cannot parse article list";
	}
	let articles: Array<[string, Article[]]> = [];
	for(const [category, table] of findTables(r.responseXML)) {
		const more = parseTable(<HTMLTableElement>table);
		articles.push([category, more]);
	}
	return articles;
}

class DownloadLink {
	elem: HTMLAnchorElement|null;

	constructor(private parent: HTMLElement) {
		this.elem = null;
	}

	private getElem(): HTMLElement {
		if(!this.elem) {
			const e = document.createElement("a");
			e.appendChild(document.createTextNode("Download PDF"));
			this.parent.appendChild(e);
			this.elem = e;
		}
		return this.elem;
	}

	set href(newurl: string) {
		const oldurl = this.getElem().getAttribute("href");
		if(oldurl) {
			URL.revokeObjectURL(oldurl);
		}
		this.getElem().setAttribute("href", newurl);
	}

	set filename(name: string) {
		this.getElem().setAttribute("download", name);
	}
}

function getDownloadFilename(wikiSelect: HTMLSelectElement, date: string): string {
	let name = "bestellung";
	if(wikiSelect.selectedOptions.length > 0) {
		name = wikiSelect.selectedOptions[0].text.toLowerCase();
	}
	return `${name}-${date}.pdf`;
}

(async () => {
	await promisedEvent(document, "DOMContentLoaded");
	const {datePicker, orderForm, wikiSelect, orderTable} = getDocumentStuff();


	let orderInfo: OrderInfo|null = null;
	const wikiPageSelected = async (_?: Event) => {
		const wikiPage = wikiSelect.value;
		if(!wikiPage) {
			return;
		}
		const [info, allArticles] = await Promise.all([
			fetchOrderInfo(`/doku.php?do=export_code&id=${wikiPage}&codeblock=0`),
			fetchArticles(`/doku.php?id=${wikiPage}&do=export_xhtmlbody`),
		]);
		orderInfo = info;
		log("using order info " + JSON.stringify(orderInfo));
		let n = 0;
		orderTable.clear();
		for(const [category, articles] of allArticles) {
			orderTable.setCategory(category);
			for(const a of articles) {
				orderTable.addArticle(a);
			}
			n += articles.length;
		}
		log(`populated table with ${n} articles`);
	};
	wikiSelect.addEventListener("change", wikiPageSelected);
	wikiPageSelected();

	const downloadLink = new DownloadLink(orderForm);
	orderForm.addEventListener("submit", async (ev: Event) => {
		ev.preventDefault();

		if(!orderInfo) {
			log("no OrderInfo set, this should not happen");
			return;
		}

		log("creating new order...");
		const order = orderTable.getOrder(orderInfo, datePicker.value);
		const blob  = await order.pdf();
		downloadLink.href     = URL.createObjectURL(blob);
		downloadLink.filename = getDownloadFilename(wikiSelect, datePicker.value);
		log(`new download link: ${downloadLink.elem?.getAttribute("href")}`);
	});
})().catch((e: string) => {
	log(e);
	alert(e);
});

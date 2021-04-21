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

const pdfmake = require("pdfmake");
import type {
	Content,
	ContentTable,
	CustomTableLayout,
	Margins,
	TableCell,
	TDocumentDefinitions,
	TFontDictionary,
} from "pdfmake/interfaces";

declare global {
	interface String {
		lpad(n: number, c: string): string;
		rpad(n: number, c: string): string;
	}
}
String.prototype.lpad = function(n: number, c: string): string {
	let x: string = <string>this;
	while(x.length < n) {
		x = c + x;
	}
	return x;
};
String.prototype.rpad = function(n: number, c: string): string {
	let x: string = <string>this;
	while(x.length < n) {
		x += c;
	}
	return x;
};

export interface OrderInfo {
	to?:        string;
	topleft:    string;
	taxid:      string;
	customerid: string;
	contact:    string;
	phone:      string;
}

export function isOrderInfo(x: any): boolean {
	if(typeof x != "object") {
		return false;
	}
	for(const k of ["to", "topleft", "taxid", "customerid", "contact", "phone"]) {
		if(!x.hasOwnProperty(k) || typeof(x[k]) != "string") {
			return false;
		}
	}
	return true;
}

const mm_to_pt = (x: number): number => x / 25.4 * 72;

export function formatUnit(u: string): string {
	const m = u.match(/^(?:[\s\u2007]*(\d+)[\s\u2007]*x[\s\u2007]*)?(\d+)(?:,(\d+)|\u2008)?\u2007*$/);
	if(!m) {
		return u;
	}
	let [_, count, integer, fraction] = m;
	count    = (count || "1").lpad(2, "\u2007");
	integer  = integer.lpad(2, "\u2007");
	fraction = fraction
		? `,${fraction.rpad(2, "\u2007")}`
		: "\u2008\u2007\u2007";
	return `${count}\u00a0x\u00a0${integer}${fraction}`;
}

const fonts: TFontDictionary = {
	"Open Sans": {
		normal:      String(new URL("fonts/OpenSans-Regular.ttf",    location.href)),
		bold:        String(new URL("fonts/OpenSans-Bold.ttf",       location.href)),
		italics:     String(new URL("fonts/OpenSans-Italic.ttf",     location.href)),
		bolditalics: String(new URL("fonts/OpenSans-BoldItalic.ttf", location.href)),
	}
};
const fontSize = 11;
const bottomMargin1em: Margins = [0, 0, 0, fontSize];
const tableLayouts: {[key: string]: CustomTableLayout} = {
	orderTable: {
		hLineWidth: (y: number, node: ContentTable): number => {
			return y <= 1 || y == node.table.body.length
				? 0.5
				: 0;
		},
		vLineWidth: () => 0
	}
};

const fromAddress: Content = {
	margin: bottomMargin1em,
	text: `Club Aquarium e.V.
St. Petersburger Str. 21
01069 Dresden`
};

export interface OrderArticle {
	id?:   string;
	name:  string;
	unit?: string;
	count: string;
}

export class Order {
	readonly tableBody: TableCell[][];
	readonly doc:       TDocumentDefinitions;

	constructor(info: OrderInfo, date: string) {
		// basic building blocks
		const shop: Content = {
			margin: bottomMargin1em,
			bold: true,
			text: info.topleft
		};
		const ids: Content = {
			margin: bottomMargin1em,
			text: `St.-Nr.: ${info.taxid}
Kd.-Nr.: ${info.customerid}`
		};
		const contact: Content = {
			margin: bottomMargin1em,
			columns: [
				{width: "*",    text: `${info.contact}: ${info.phone.replace(/\u202f+/g, " ")}`},
				{width: "auto", text: `Datum: ${date}`},
			]
		};
		const header: TableCell[] = ["Artikel-Nr.", "Artikel", "Gebinde", "Bestellmenge"]
			.map((x: string) => {
				return {text: x, bold: true, alignment: "center"};
			});
		this.tableBody = [header];
		const table: Content = {
			margin: bottomMargin1em,
			columns: [
				{width: "*", text: ""},
				{
					width:  "auto",
					layout: "orderTable",
					table: {
						headerRows: 1,
						body: this.tableBody
					}
				},
				{width: "*", text: ""},
			]
		};
		const closing: Content = {text: `Mit freundlichen Grüßen
${info.contact}
Club Aquarium e.V.`};

		// assemble document
		this.doc = {
			content: [
				shop,
				fromAddress,
				ids,
				contact,
				table,
				closing,
			],
			pageSize:        "A4",
			pageOrientation: "portrait",
			pageMargins:     [mm_to_pt(20), mm_to_pt(15)],
			defaultStyle: {
				font: "Open Sans",
				fontSize: fontSize,
			}
		};
	}

	add(article: OrderArticle): void {
		this.tableBody.push([
			{margin: [6, 0], text: article.id || "",               alignment: "right"},
			{margin: [6, 0], text: article.name},
			{margin: [6, 0], text: formatUnit(article.unit || ""), alignment: "center"},
			{margin: [6, 0], text: article.count,                  alignment: "center"},
		]);
	}

	async pdf(): Promise<Blob> {
		const pdf = pdfmake.createPdf(this.doc, tableLayouts, fonts);
		console.log(pdf);
		return new Promise((resolve, _) => {
			pdf.getBlob(resolve);
		});
	}
}

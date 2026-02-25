import { XY, buildNavHTML, buildNearbyHTML } from './nav';

export const renderTerminalPick = (title:string, items:{id:string;label:string}[]) => `
  <div class="rounded-xl border bg-white p-3 shadow-sm">
    <div class="font-semibold mb-2">${title}</div>
    <div>
      ${items.map(t=>`
        <button data-action="pick-terminal" data-id="${t.id}"
          class="px-3 py-2 my-1 mr-2 rounded-xl border bg-white hover:bg-gray-50">${t.label}</button>`
      ).join('')}
    </div>
  </div>`;

export const renderNavCard = (title:string, to:XY, origin?:XY|string) => `
  <div class="rounded-xl border bg-white p-3 shadow-sm">
    <div class="font-semibold mb-2">${title}</div>
    <div class="mb-2">${buildNavHTML(to, origin)}</div>
    <div>${buildNearbyHTML(to)}</div>
  </div>`;



















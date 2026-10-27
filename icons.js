// Replace presentation-only emoji in rendered text, including dynamically rendered lists.
// Values in inputs, scripts, accessible labels and stored records are never modified.
const iconNames = new Map([
  ['🏫','school'],['🔍','search'],['📋','record'],['👤','user'],['👥','users'],
  ['📊','chart'],['⚙️','settings'],['⚙','settings'],['🔒','lock'],['💄','makeup'],
  ['👔','uniform'],['🏷️','tag'],['🏷','tag'],['🩴','slipper'],['🏃','sport'],
  ['🧥','jacket'],['🚭','smoking'],['📝','edit'],['✏️','edit'],['⚠️','warning'],
  ['⚠','warning'],['🚨','warning'],['⛔','warning'],['✅','check'],['🗑️','trash'],
  ['🗑','trash'],['📂','folder'],['🔑','key'],['⏳','clock'],['❌','error']
]);
const iconPattern = new RegExp([...iconNames.keys()].join('|'), 'gu');
function replaceIconText(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = root.parentElement;
    if (!parent || parent.closest('script,style,textarea,input,option,title,svg,[data-no-icons]')) return;
    const text = root.nodeValue;
    iconPattern.lastIndex = 0;
    if (!iconPattern.test(text)) return;
    iconPattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(iconPattern)) {
      fragment.append(text.slice(cursor, match.index));
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('app-icon');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('focusable','false');
      const use = document.createElementNS('http://www.w3.org/2000/svg','use');
      // Seatbelt is distinct from the password lock even though both used the same emoji.
      const name = parent.closest('[id="rb-안전벨트 미착용"]') ? 'seatbelt' : iconNames.get(match[0]);
      svg.dataset.icon = name;
      use.setAttribute('href',`assets/icons.svg#${name}`);
      svg.append(use);
      fragment.append(svg);
      cursor = match.index + match[0].length;
    }
    fragment.append(text.slice(cursor));
    root.replaceWith(fragment);
  } else if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.matches('script,style,textarea,input,option,title,svg,[data-no-icons]')) return;
    [...root.childNodes].forEach(replaceIconText);
  }
}
replaceIconText(document.body);
const iconObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') replaceIconText(record.target);
    else record.addedNodes.forEach(replaceIconText);
  }
});
iconObserver.observe(document.body,{childList:true,subtree:true,characterData:true});

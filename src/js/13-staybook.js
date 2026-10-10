/* ============ staybook ============ */
const PAGE_ORDER=['1','2','3','5','last'];let bookIdx=0,bookRes=null;
function renderPage(key,isNew){const p=PAGES[key],el=$('#book');const h=el.querySelector('.hand');h.className='hand '+p.who;h.textContent=p.text;
  el.querySelector('.teach').textContent=p.teach;el.querySelector('.pnum').textContent=key==='last'?'last page':'page '+key;$('#bkNew').hidden=!isNew;
  const list=PAGE_ORDER.filter(k=>ST.pages.includes(k));$('#bkPrev').hidden=$('#bkNext').hidden=isNew||list.length<2;}
function unlockPage(key){if(!ST.pages.includes(key))ST.pages.push(key);AU.page();return new Promise(res=>{renderPage(key,true);$('#book').hidden=false;bookRes=res;
  setTimeout(()=>{aWaiter=()=>{aWaiter=null;closeBook();};$('#bkClose').focus();},350);});}
function openBook(){if(!ST.pages.length){toast('The staybook is empty.');return;}AU.page();const list=PAGE_ORDER.filter(k=>ST.pages.includes(k));bookIdx=list.length-1;renderPage(list[bookIdx],false);$('#book').hidden=false;
  const prev=mode;setMode('menu');bookRes=()=>{setMode(prev==='menu'?'explore':prev);};$('#bkClose').focus();}
function closeBook(){AU.close();$('#book').hidden=true;aWaiter=null;const r=bookRes;bookRes=null;r&&r();}
$('#bkClose').onclick=closeBook;
$('#bkPrev').onclick=()=>{const l=PAGE_ORDER.filter(k=>ST.pages.includes(k));bookIdx=(bookIdx-1+l.length)%l.length;renderPage(l[bookIdx],false);AU.page();};
$('#bkNext').onclick=()=>{const l=PAGE_ORDER.filter(k=>ST.pages.includes(k));bookIdx=(bookIdx+1)%l.length;renderPage(l[bookIdx],false);AU.page();};


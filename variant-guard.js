(function(){'use strict';
 const $=id=>document.getElementById(id);
 let options=null;
 const map={'Normal':'normal','Holo':'holo','Reverse Holo':'reverse'};
 function apply(card){options=card&&card.variants&&typeof card.variants==='object'?card.variants:null;
  const sel=$('scanFinish');if(!sel)return;
  for(const opt of sel.options){const k=map[opt.value];opt.disabled=!!(options&&k&&options[k]===false);}
  if(sel.selectedOptions[0]?.disabled)sel.value='Other / special';
  let msg=$('foilEvidence');if(!msg){msg=document.createElement('p');msg.id='foilEvidence';msg.className='note';sel.insertAdjacentElement('afterend',msg);}
  msg.textContent=options?'Known variants (database): '+Object.entries(map).filter(([,k])=>options[k]===true).map(([label])=>label).join(', ')+'. Foil appearance still requires inspection.':'Variant availability unknown: visually verify finish.';
 }
 function check(card,finish){if(!card||!card.id)return true;const k=map[finish];return !(k&&card.variants&&card.variants[k]===false);}
 function reset(){options=null;let s=$('scanFinish');if(s)for(const o of s.options)o.disabled=false;let m=$('foilEvidence');if(m)m.textContent='No verified match selected.';}
 window.PokeFlipVariantGuard={apply,check,reset};
})();
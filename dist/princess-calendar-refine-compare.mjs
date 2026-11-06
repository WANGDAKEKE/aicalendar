// Fit each complete 453 × 912 canvas to its own card. Prototype state and
// scrolling are intentionally independent: never inspect or message a frame.
const cards=[...document.querySelectorAll('.prc-card')];
let scheduled=false;

function fitRefineComparison(){
  scheduled=false;
  for(const card of cards){
    const width=Math.max(240,card.getBoundingClientRect().width);
    card.style.setProperty('--prc-scale',String(Math.min(.94,width/453)));
  }
}

function scheduleFit(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(fitRefineComparison);
}

fitRefineComparison();
window.addEventListener('resize',scheduleFit,{passive:true});
if('ResizeObserver' in window){
  const observer=new ResizeObserver(scheduleFit);
  for(const card of cards)observer.observe(card);
}

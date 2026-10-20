// Keeps native details/scroll state, but a user's toggle always overrides autoplay.
export class ActionPanel {
  constructor(panel,setExpanded){this.panel=panel;this.setExpanded=setExpanded;this.session=null;}
  start(){
    this.session={scroll:this.panel.scrollTop,expanded:this.panel.dataset.expanded==='true',manual:false};
    this.setExpanded(false);
  }
  manualToggle(){if(this.session)this.session.manual=true;}
  update(busy){
    if(!this.session||busy)return;
    const saved=this.session;this.session=null;
    if(!saved.manual){this.setExpanded(saved.expanded);this.panel.scrollTop=saved.scroll;requestAnimationFrame(()=>{if(!this.session)this.panel.scrollTop=saved.scroll;});}
  }
  cancel(){this.session=null;}
}

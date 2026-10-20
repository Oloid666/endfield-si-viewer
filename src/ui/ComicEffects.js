import { Vector3, MathUtils } from 'three';

const ANGER = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 25 Q25 28 25 7 M39 7 Q36 26 57 25 M57 39 Q38 36 39 57 M25 57 Q28 38 7 39" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="square"/></svg>';

// Three reusable screen-facing marks, projected from the actual head each frame.
// No textures, extra render loop, pointer interception or postprocessing.
export class ComicEffects {
  constructor(parent, config) {
    this.config = config;
    this.root = document.createElement('div');
    this.root.className = 'comic-effects';
    this.root.setAttribute('aria-hidden', 'true');
    this.items = Array.from({ length: 3 }, () => {
      const node = document.createElement('div');
      node.className = 'comic-mark'; this.root.append(node); return node;
    });
    parent.append(this.root);
    this.point = new Vector3(); this.amount = 0; this.time = 0; this.selection = '';
  }

  update(delta, camera, anchor, expression, blocked) {
    const strength = expression?.strength || 0;
    const target = anchor && !blocked ? MathUtils.clamp((strength-.5)/1.5, 0, 1) : 0;
    this.amount = MathUtils.lerp(this.amount, target, 1-Math.exp(-delta*this.config.response));
    if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.time += delta;
    const selection = expression?.selection || '';
    if (selection !== this.selection) {
      this.selection = selection; this.amount = 0;
      const labels = selection === 'proud' ? ['雜魚～','就這？','哼哼'] : ['！','！！','！？'];
      this.items.forEach((node, i) => {
        node.className = `comic-mark ${selection}`;
        if (selection === 'angry') node.innerHTML = ANGER;
        else node.textContent = labels[i];
      });
    }
    this.root.hidden = !anchor || this.amount < .002 || !['angry','proud','surprised'].includes(selection);
    if (this.root.hidden) return;
    this.point.copy(anchor.position).project(camera);
    if (this.point.z < -1 || this.point.z > 1) { this.root.hidden = true; return; }
    const width = this.root.clientWidth, height = this.root.clientHeight;
    const x = (this.point.x+1)*width/2, y = (1-this.point.y)*height/2;
    const scale = .65 + this.amount*((selection === 'proud' ? 1.4 : this.config.maxScale)-.65);
    this.items.forEach((node, i) => {
      const visibility = MathUtils.clamp((this.amount-i*.35)/.12, 0, 1);
      const side = i === 1 ? -1 : 1;
      const dx = side*(62+i*13)*(.9+this.amount*.25);
      const dy = (selection === 'proud' ? -130-i*70 : -95-i*48) + Math.sin(this.time*2+i)*3;
      const pulse = 1 + this.amount*.035*Math.sin(this.time*4+i);
      // Clamp centres, leaving room for the enlarged bubble at screen edges.
      const margin = Math.min(width/2, selection==='proud' ? 78*scale : 45*scale);
      const px = MathUtils.clamp(x+dx, margin, width-margin);
      const py = MathUtils.clamp(y+dy, 40*scale, height-40*scale);
      node.style.opacity = String(visibility);
      node.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%) rotate(${side*(8+i*3)}deg) scale(${scale*pulse*(i ? .8 : 1)})`;
    });
  }

  dispose() { this.root.remove(); }
}

/* Norlens: arah arus dana. Dimuat SETELAH script utama di index.html. */
(function () {
    const sec = document.createElement("section");
    sec.className = "panel";
    sec.id = "flowPanel";
    sec.innerHTML = `
        <div class="head"><div>
            <h2>Arah arus dana (money flow)</h2>
            <p class="sub">Perkiraan akumulasi atau distribusi dari pola harga dan volume (OBV, CMF, MFI). Ini proksi, bukan data net foreign buy/sell resmi BEI.</p>
        </div><span class="st na" id="flowTag">Belum ada data</span></div>
        <div class="score-grid">
            <div>
                <div class="score-top"><div class="ring" id="flowRing"></div>
                    <div><div style="font-weight:600" id="flowTitle">Belum ada data</div>
                    <div class="small muted" id="flowText">Cari kode saham terlebih dahulu.</div></div></div>
                <div id="flowBars"></div>
            </div>
            <div class="stats c2" id="flowStats"></div>
        </div>
        <h3>OBV dan Chaikin Money Flow (120 hari bursa terakhir)</h3>
        <div class="legend" id="flowLegend"></div>
        <div class="chart" id="flowChart"></div>
        <ul class="signal-list neutral" id="flowWhy"></ul>`;
    $("priceChart").closest("section").insertAdjacentElement("afterend", sec);
 
    const N = 120;
 
    function calc(s) {
        const n = s.length;
        const H = s.map((d) => fin(d.h) ? d.h : d.c), L = s.map((d) => fin(d.l) ? d.l : d.c);
        const V = s.map((d) => fin(d.v) ? d.v : 0);
        const obv = new Array(n).fill(0), mfv = new Array(n).fill(0), tp = new Array(n).fill(0);
        const cmf = new Array(n).fill(NaN);
        for (let i = 0; i < n; i++) {
            const rng = H[i] - L[i];
            mfv[i] = (rng > 0 ? ((s[i].c - L[i]) - (H[i] - s[i].c)) / rng : 0) * V[i];
            tp[i] = (H[i] + L[i] + s[i].c) / 3;
            if (i) obv[i] = obv[i - 1] + Math.sign(s[i].c - s[i - 1].c) * V[i];
        }
        for (let i = 19; i < n; i++) {
            let a = 0, b = 0;
            for (let k = i - 19; k <= i; k++) { a += mfv[k]; b += V[k]; }
            cmf[i] = b > 0 ? a / b : 0;
        }
        let pos = 0, neg = 0;
        for (let k = n - 14; k < n; k++) {
            const f = tp[k] * V[k];
            if (tp[k] > tp[k - 1]) pos += f; else if (tp[k] < tp[k - 1]) neg += f;
        }
        const mfi = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
        return { obv, obvSma: sma(obv, 20), cmf, mfi, V };
    }
 
    function draw(box, s, f) {
        const total = s.length, from = Math.max(0, total - N), n = total - from;
        const base = f.obv[from];
        const O = f.obv.slice(from).map((v) => v - base);
        const S = f.obvSma.slice(from).map((v) => v - base);
        const C = f.cmf.slice(from);
        const u = pickUnit(Math.max(1, ...O.map(Math.abs)));
        const O2 = O.map((v) => v / u.size), S2 = S.map((v) => v / u.size);
        const w = Math.max(box.clientWidth, 280);
        const m = { t: 10, r: 12, b: 24, l: 56 }, h1 = 150, gap = 18, h2 = 80;
        const h = m.t + h1 + gap + h2 + m.b, iw = w - m.l - m.r;
        const vals = O2.concat(S2).filter(fin);
        const sc = niceTicks(Math.min(...vals), Math.max(...vals), 3);
        const x = (i) => m.l + iw * i / (n - 1);
        const y1 = (v) => m.t + (sc.hi - v) / (sc.hi - sc.lo) * h1;
        const cm = Math.max(0.1, ...C.filter(fin).map(Math.abs));
        const y0 = m.t + h1 + gap;
        const y2 = (v) => y0 + (cm - v) / (2 * cm) * h2;
        const path = (arr, yf) => {
            let d = "", pen = false;
            arr.forEach((v, i) => {
                if (!fin(v)) { pen = false; return; }
                d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + yf(v).toFixed(1) + " ";
                pen = true;
            });
            return d;
        };
 
        let g = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Grafik OBV dan CMF">`;
        sc.ticks.forEach((t) => {
            g += `<line class="gl" x1="${m.l}" x2="${w - m.r}" y1="${y1(t)}" y2="${y1(t)}"/>`;
            g += `<text class="ax" x="${m.l - 8}" y="${y1(t) + 4}" text-anchor="end">${tickLabel(t)}</text>`;
        });
        g += `<path d="${path(O2, y1)}" fill="none" stroke-width="2" style="stroke:var(--c1)"/>`;
        g += `<path d="${path(S2, y1)}" fill="none" stroke-width="1.6" style="stroke:var(--c3)"/>`;
        [cm, 0, -cm].forEach((t) => {
            g += `<line class="${t === 0 ? "zero" : "gl"}" x1="${m.l}" x2="${w - m.r}" y1="${y2(t)}" y2="${y2(t)}"/>`;
            g += `<text class="ax" x="${m.l - 8}" y="${y2(t) + 4}" text-anchor="end">${t.toFixed(2).replace(".", ",")}</text>`;
        });
        const bw = Math.max(1, iw / n * 0.75);
        C.forEach((v, i) => {
            if (!fin(v)) return;
            g += `<rect x="${x(i) - bw / 2}" y="${Math.min(y2(v), y2(0))}" width="${bw}" height="${Math.max(Math.abs(y2(v) - y2(0)), 1)}" style="fill:${v >= 0 ? "var(--up)" : "var(--down)"};opacity:.75"/>`;
        });
        for (let k = 0; k < 4; k++) {
            const i = Math.round(k * (n - 1) / 3);
            g += `<text class="ax" x="${x(i)}" y="${h - 6}" text-anchor="${k === 0 ? "start" : k === 3 ? "end" : "middle"}">${new Date(s[from + i].t).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</text>`;
        }
        const bottom = y0 + h2;
        g += `<line id="fcl" class="gl" y1="${m.t}" y2="${bottom}" style="stroke:var(--muted);stroke-dasharray:3 3;visibility:hidden"/>`;
        g += `<rect class="ov" data-own-tip x="${m.l}" y="${m.t}" width="${iw}" height="${bottom - m.t}" fill="transparent" style="touch-action:pan-y"/>`;
        box.innerHTML = g + "</svg>";
 
        const svg = box.querySelector("svg"), cl = svg.querySelector("#fcl"), ov = svg.querySelector(".ov");
        ov.addEventListener("pointermove", (e) => {
            const r = svg.getBoundingClientRect();
            const i = clip(Math.round(((e.clientX - r.left) * (w / r.width) - m.l) / iw * (n - 1)), 0, n - 1);
            cl.setAttribute("x1", x(i)); cl.setAttribute("x2", x(i)); cl.style.visibility = "visible";
            showTip(`<b>${new Date(s[from + i].t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</b><br>` +
                `${dot("var(--c1)")}OBV: ${tickLabel(O2[i])} ${u.label}<br>` +
                `${dot("var(--c3)")}Rata-rata 20 hari: ${fin(S2[i]) ? tickLabel(S2[i]) + " " + u.label : "-"}<br>` +
                `CMF 20 hari: ${fin(C[i]) ? C[i].toFixed(2).replace(".", ",") : "-"}`, e.clientX, e.clientY);
        });
        ov.addEventListener("pointerleave", () => { cl.style.visibility = "hidden"; hideTip(); });
        $("flowLegend").innerHTML = legendHTML([
            { name: "OBV (dihitung ulang dari awal periode, dalam " + (u.label || "lembar") + ")", color: "var(--c1)" },
            { name: "Rata-rata OBV 20 hari", color: "var(--c3)" },
            { name: "CMF 20 hari (batang bawah)", color: "var(--up)" }
        ]);
    }
 
    function placeholder(msg) {
        $("flowTag").className = "st na"; $("flowTag").textContent = "Belum ada data";
        $("flowRing").innerHTML = ""; $("flowTitle").textContent = "Belum ada data";
        $("flowText").textContent = msg; $("flowBars").innerHTML = ""; $("flowStats").innerHTML = "";
        $("flowLegend").innerHTML = ""; $("flowWhy").innerHTML = "";
        $("flowChart").innerHTML = `<p class="empty">${msg}</p>`;
    }
 
    function renderFlow() {
        const p = state.prices["1y"];
        if (!p || p.series.length < 60) return placeholder("Butuh minimal 60 hari data harga dan volume.");
        const s = p.series;
        if (!s.some((d) => fin(d.v) && d.v > 0)) return placeholder("Data volume tidak tersedia untuk saham ini.");
        const f = calc(s), n = s.length, last = n - 1;
 
        let up = 0, dn = 0, v20 = 0;
        for (let k = last - 19; k <= last; k++) {
            v20 += f.V[k];
            if (s[k].c > s[k - 1].c) up += f.V[k]; else if (s[k].c < s[k - 1].c) dn += f.V[k];
        }
        const ud = dn > 0 ? up / dn : (up > 0 ? 3 : 1);
        const slope = v20 > 0 ? (f.obv[last] - f.obv[last - 20]) / v20 : 0;
        const priceChg = calcGrowth(s[last].c, s[last - 20].c);
        const cmf = f.cmf[last], above = f.obv[last] > f.obvSma[last];
 
        const axes = [
            { name: "CMF 20 hari", score: scl(cmf, -0.15, 0.15) },
            { name: "Aliran OBV", score: scl(slope, -0.3, 0.3) },
            { name: "Volume naik/turun", score: scl(ud, 0.6, 1.6) },
            { name: "MFI 14 hari", score: scl(f.mfi, 30, 70) }
        ].filter((a) => fin(a.score));
        const o = Math.round(avgF(...axes.map((a) => a.score)));
        const [cls, label] = o >= 62 ? ["good", "Cenderung akumulasi"] : o <= 38 ? ["warn", "Cenderung distribusi"] : ["ok", "Arus dana netral"];
 
        $("flowTag").className = "st " + cls; $("flowTag").textContent = label;
        $("flowRing").innerHTML = ringSVG(o, "var(--brand)");
        $("flowTitle").textContent = label;
        $("flowText").textContent = `Skor arus dana ${o}/100 dari ${axes.length} indikator (50 = seimbang).`;
        $("flowBars").innerHTML = barRows(axes);
 
        $("flowStats").innerHTML = [
            tile("CMF 20 hari", fin(cmf) ? cmf.toFixed(2).replace(".", ",") : "-", "Di atas 0 = tekanan beli, di bawah 0 = tekanan jual", cmf >= 0 ? "up" : "down"),
            tile("MFI 14 hari", f.mfi.toFixed(0), f.mfi >= 80 ? "Jenuh beli" : f.mfi <= 20 ? "Jenuh jual" : "Zona normal (20 sampai 80)"),
            tile("Volume hari naik / turun", ud.toFixed(2).replace(".", ",") + "x", "Total volume 20 hari: hari naik dibanding hari turun", ud >= 1 ? "up" : "down"),
            tile("OBV vs rata-rata 20 hari", above ? "Di atas" : "Di bawah", above ? "Volume mengalir searah kenaikan" : "Volume mengalir searah penurunan", above ? "up" : "down")
        ].join("");
 
        const why = [];
        why.push(`CMF ${cmf.toFixed(2).replace(".", ",")}: penutupan harian ${cmf >= 0.05 ? "cenderung dekat harga tertinggi, tanda tekanan beli" : cmf <= -0.05 ? "cenderung dekat harga terendah, tanda tekanan jual" : "tidak condong ke salah satu sisi"}.`);
        if (priceChg > 2 && slope < -0.05) why.push("Divergensi bearish: harga naik 20 hari terakhir tetapi OBV turun. Kenaikan kurang didukung volume, waspadai distribusi.");
        else if (priceChg < -2 && slope > 0.05) why.push("Divergensi bullish: harga turun 20 hari terakhir tetapi OBV naik. Ada indikasi akumulasi saat harga lemah.");
        else why.push(`Harga ${showSigned(priceChg)} dalam 20 hari dan arah OBV sejalan, tidak ada divergensi yang menonjol.`);
        why.push("Sinyal ini turunan harga dan volume, sehingga tidak membedakan pembeli asing, institusi, atau ritel. Gunakan sebagai konfirmasi tren, bukan prediksi pasti.");
        $("flowWhy").innerHTML = why.map((t) => `<li>${t}</li>`).join("");
 
        draw($("flowChart"), s, f);
    }
 
    window.renderFlow = renderFlow;
    renderFlow();
})();
# Theory, equations and assumptions

All symbols use SI units unless stated otherwise. m is the number of phases, 2p the number of poles, Q the number of stator slots, f the supply frequency, and n_s = f/p the synchronous speed in rev/s.

## 1. Output equation (D²L)

Input apparent power from the rating and the assumed efficiency and power factor:

    S = Pₙ / (η · cos φ)

Output coefficient and volume, with n_s in rev/s:

    C₀ = 11 · k_w1 · B_av · ac · 10⁻³          [kVA·s/m³]
    D²L = S[kVA] / (C₀ · n_s)

The factor 11 ≈ 1.11·π² comes from `S = m·E·I` with `E = 4.44·f·Φ·k_w·N`, `Φ = B_av·πDL/(2p)` and `ac = 2mNI/(πD)`.

The aspect ratio λ = L/τ, with pole pitch τ = πD/(2p), splits the volume:

    D = ∛(D²L · 2p / (π·λ)),   L = D²L / D²

A manual mode accepts D and L directly.

**Air gap** (empirical, can be overridden):

| Machine | Air gap |
| --- | --- |
| Induction | δ = 0.2 + 0.01·P^0.4 mm (2 poles), 0.18 + 0.006·P^0.4 mm (more poles) — Pyrhönen |
| PM | δ = 0.5 + 0.005·P^0.4 mm |
| Wound field | δ = γ·τ·A/B̂δ, with γ = 7·10⁻⁷ (salient) or 4·10⁻⁷ (cylindrical) |

## 2. Stator

- **Turns** from the EMF: `N_ph = E / (4.44·f·Φ₁·k_w1)`.
  - E is about 0.93–0.97·V_ph for induction machines, about 1.0·V_ph for wound-field machines, and set by the user's E₀/V_ph ratio for PM machines.
  - Conductors per slot `Z_s = 2·m·N_ph·a / Q` are rounded to a multiple of the layer count.
  - For induction and wound-field machines the actual flux is rescaled (the voltage sets the flux). For PM machines the EMF changes instead (the magnets set the flux).
- **Conductor area**: `a_c = I_ph / (a·J)`. It is split into strands no larger than d_max.
- **Required slot winding area**: `A = Z_s·a_c / k_fill`.
- **Tooth width** for a peak tooth density B_t,max: `b_t = B̂_g·τ_s / (k_fe·B_t,max)`, where τ_s = πD/Q.
  - B̂_g = (π/2)·B_av for sinusoidal fields.
  - B̂_g is the flat-top gap density for PM and salient-pole machines.
- **Slot auto-sizing**: every shape has `build(ctx, h)`, which returns all dimensions for a body depth h while keeping the tooth width (parallel-sided teeth or slots, depending on the shape). The depth is found by bisection so that the conductor area equals A. The search is bracketed on the rising part of area(h), because rotor slots narrow towards the shaft.
- **Yoke**: `h_y = Φ / (2·k_fe·L·B_y,max)`, with Φ = B_av·τ·L.
- **Carter coefficient**: `k_C = τ_s / (τ_s − γ·g)`, with `γ = (b₀/g)² / (5 + b₀/g)`.
- **Mean turn length**: `l_mt = 2·(L + l_ew)`, with `l_ew = π·(y·τ_s,mid)/2 + 2·l_straight`.
- **Phase resistance**: `R_ph = ρ(T)·N_ph·l_mt / (a·a_c)`.

## 3. Windings

### Star of slots
Slot k has EMF phasor angle `α_k = k·2πp/Q`. The phasors are sorted into 2m phase belts of width π/m, starting at 0. For odd m the belts alternate +A, −C, +B, −A, +C, −B, …. For even m the phase axes are spaced π/m apart.

### Layout generators
- **Double layer**: the top layer of slot k takes the phase of phasor k. The return side goes into the bottom layer of slot k + y.
- **Single layer**:
  - If Q is divisible by 2p, each whole slot is classified (equivalent to a full-pitch double layer).
  - Otherwise every second coil of an odd-pitch double layer is kept (alternate-teeth windings).
- **Any number of layers (layer stack)**: every layer l is the base layer (the top layer of the double layer above) shifted by d_l slots with polarity s_l = ±1 and relative turns w_l (1 by default). A layer with w_l = 2 takes twice the slot area.
  - The standard double layer is the stack `[0+, y−]`.
  - More layers add shifted copies. Because every phase is shifted equally, any stack built from a balanced base layer stays balanced.
  - The default stack for an even L is a series of (go, return) pairs, each further pair rotated by one star step (2π·t/Q electrical, t = gcd(Q, p)). The physical shift for that is the k with k·p ≡ t (mod Q).
  - **Three layers for every slot/pole combination**: an odd L ends with the group `[b+ ×1, (b+y)− ×2, (b+2y)+ ×1]`. These are two double layers (pitches +y and −y) whose return sides share the middle layer, which therefore carries double turns. Its layer factor is (1 − e^{−jνyθ_s})², so `k_w1 = k_w1,base·k_p²`. Pitch harmonics are suppressed twice, and the winding always closes into coils.
  - Equal-turn odd stacks only close when every layer is polarity-balanced on its own. That fails whenever Q/m is odd (each layer then has an odd surplus of coil sides per phase), for example 9 slots/8 poles. The closing condition is Σ s_l·w_l = 0 whenever the base layer is unbalanced.
  - The optimiser searches the shift, polarity and turns (×1 or ×2) of every layer. It rejects stacks in which two layers coincide electrically, since those are one layer with more turns.
  - Example: the four-layer 12-slot/10-pole stack `[0+, 1−, 5+, 6−]` reduces the first sub-harmonic by about 73 % while k_w1 drops from 0.933 to 0.901.
  - Example: `[0+, 1−, 2+]` is a three-layer 12-slot/10-pole winding with k_w1 = 0.880.
  - Example: 9 slots/8 poles has no equal-turn three-layer winding, but `[0+, 1−×2, 2+]` gives k_w1 = 0.931.
  - In anti-periodic windings a shift of Q/(2t) only flips the polarity, so two layers can coincide electrically. The slot then holds the same coil side twice, which is a winding with unequal turns per layer. Such stacks are allowed and labelled.
- **Fast evaluation of stacks**: with layer factor `F_ν = Σ_l s_l·w_l·e^{−jν·2π·d_l/Q}`, the spectrum of a stack is the base spectrum times F_ν:
  - `k_w,ν = k_w,ν(base)·|F_ν| / Σ w_l`
  - `F_ν(MMF) = F_ν(base MMF)·|F_ν|`

  This makes exhaustive or coordinate-descent searches over shifts and polarities cheap. The stack optimiser and the suggestions use it.
- **Configuration suggestions**: for given Q, 2p and m, the app
  - checks feasibility (Q/(m·t) integer)
  - lists single-layer windings (full pitch, or odd spans for alternate-teeth windings)
  - lists every double-layer coil span from about 0.6 of full pitch to full pitch
  - adds the best optimised stacks for 3…N layers

  Results are ranked by k_w1, MMF THD, σ_δ, sub-harmonic content or average coil span (end-winding length). A second table proposes alternative slot numbers for the same pole count, with LCM (cogging) and GCD (unbalanced magnetic pull).
- **Custom**: any matrix [layer][slot] of (phase, ±). Coils are inferred by greedy pairing.

### Winding function and harmonics
Let c_j,k be the net conductors of phase j in slot k (layer units). Then:

- Turns function `n_j(θ) = Σ_{i≤k} c_j,i`, and winding function `M_j = n_j − ⟨n_j⟩`.
- For mechanical order ν, define `C_j,ν = Σ_k c_j,k·e^{−jνθ_k}`:
  - winding factor `k_w,ν = |C_j,ν| / (number of coil sides)`
  - harmonic amplitude of M_j is `|C_j,ν| / (πν)`
- Pitch and distribution factors (single-pitch layouts): `k_p,ν = |sin(ν·y·π/Q)|`, `k_d,ν = k_w,ν / k_p,ν`.
- Slot-opening factor: `k_so,ν = sinc(ν·β/2)`, with β = b₀/R. Skew factor: `k_sk,ν = sinc(ν·γ_sk/2)`.

Rotating MMF with currents `i_j = Î·cos(ωt − θ_j)`:

    F_ν,fwd = ½·|Σ_j C_j,ν·e^{+jθ_j}| / (πν)
    F_ν,bwd = ½·|Σ_j C_j,ν·e^{−jθ_j}| / (πν)

- MMF THD = √(Σ_{ν≠p} F_ν²) / F_p.
- Differential (harmonic) leakage `σ_δ = Σ_{ν≠p} (F_ν/F_p)²`, summed to a high order. For q = 3 at full pitch this gives 1.41 %, in agreement with tables.

### Other winding properties
- **Balance**: equal phasor magnitudes, equal coil-side counts, and phase displacement equal to the axis spacing.
- **Parallel paths**: the largest a for which the coils of every phase split into a contiguous groups with equal EMF phasors.
- **Slot/pole indicators**:
  - q = Q/(2pm)
  - t = gcd(Q, p)
  - cogging order LCM(Q, 2p)
  - lowest radial-force order GCD(Q, 2p); a value of 1 means unbalanced magnetic pull

## 4. Rotors

### Induction, cage
- **Rotor slot number**: chosen near 0.83·Q_s, avoiding the Richter/Sawhney combinations:
  - Q_r ≠ Q_s
  - Q_s − Q_r ≠ ±p, ±2p, ±3p, ±5p (cusps)
  - Q_s − Q_r ≠ ±1, ±2, ±(p±1), ±(p±2) (noise)
  - Q_r not a multiple of 6p (crawling)
- **Bar current**: `I_b = 2·m·k_w1·N_ph·I_ph·cos φ / Q_r`.
- **Ring current**: `I_e = I_b / (2·sin(πp/Q_r))`.
- **Areas** follow from the bar and ring current densities. The bar slot is auto-sized like the stator slot, with the tooth narrowing towards the shaft.
- **Resistance referred to the stator**:

      R₂' = 4m(k_w1·N_ph)²/Q_r · [R_b + R_e,seg / (2·sin²(πp/Q_r))]

- **Rotor leakage** comes from the numerically integrated slot permeance plus an end-ring term, with rotor differential leakage `(πp/Q_r)²/sin²(πp/Q_r) − 1` and skew leakage `(1 − k_sk²)·L_m`.

### Induction, wound rotor
Q_r = 2p·m·q_r with a double-layer winding. N₂ follows from the slip-ring voltage. R₂' and L₂' are referred with `(k_w1·N₁ / k_w2·N₂)²`.

### SPM
- Gap density with leakage factor k_l:

      B_g = k_l·B_r·(h_m/μ_r) / (h_m/μ_r + k_C·(g + t_sleeve))

- Auto h_m solves this for the target `B_g = B_av/α_p`.
- Fundamental: `B̂_g1 = (4/π)·B_g·sin(α_p·π/2)`.

### IPM (V or bar)
- Flux-concentration magnetic circuit with saturated bridges (2 T):

      B_g = (k_l·B_r·A_m/A_g − Φ_bridge/A_g) / (1 + μ_r·(A_m/A_g)·(k_C·g/h_m))

- Magnet width is solved for the target B_g within the geometric limits: bridge to the rotor surface, pole pitch, and minimum yoke above the shaft.
- `L_q = ξ·L_d`, where ξ is an input.

### Wound field, salient
- Pole body width `b_p = σ_p·Φ / (k_fe·L·B_p)`, with σ_p = 1.15.
- The coil fills the interpolar space under the pole shoe. Its usable width shrinks with radius, and the coil depth is solved from the coil area `F_f / (J_f·k_ff)`.
- Excitation EMF E₀ from the two-reaction phasor diagram, with V = E₀ + R·I + jX_d·I_d + jX_q·I_q and the target (leading) power factor.
- Field MMF = gap MMF × E₀/E + iron MMF × E_δ/E.
- Field conductor area `a_f = ρ·2p·l_mt,f·F_f / (0.95·V_f − 2 V)`.
- d and q factors, with α = ψπ:

      k_d = (α + sin α)/π
      k_q = (α − sin α)/π + (2/(3π))·cos(α/2)

### Wound field, cylindrical
About 2/3 of each pole pitch is wound. Slot ampere-conductors are `Θ = 2·F_f / n_w`.

## 5. Magnetic circuit and inductances

- **MMF per pole**: `F = B̂_g·k_C·g/μ₀ + H(B_ts)·h_s + H(B_tr)·h_r + H(B_ys)·τ_ys/3 + H(B_yr)·τ_yr/3`, using the lamination's B–H curve.
- Saturation factor `k_sat = F / F_gap`. Effective gap `δ_ef = k_C·g·k_sat + h_m/μ_r` (+ sleeve).
- **Magnetizing inductance**: `L_m = (m/2)·4·μ₀·(k_w1·N)²·τ·L / (π²·p·δ_ef)`.
- **Slot leakage**: `L_u = (4m/Q)·μ₀·L·N²·λ_u`. The permeance is integrated numerically from the actual contour:

      λ = ∫ (A_below(u)/A)² / b(u) du   (conductor region)
        + ∫ du / b(u)                     (opening and wedge)

  Short-pitch factors `k₁ = 1 − 9ε/16` and `k₂ = 1 − 3ε/4` are applied, and the tooth-tip term is `5(g/b₀)/(5 + 4g/b₀)`.
- **End winding**: `L_ew = (4m/Q)·q·N²·μ₀·(2·l_ew)·λ_w`, with λ_w = 0.3.
- **Differential leakage**: `L_δσ = σ_δ·L_m`, with σ_δ from the winding analysis.

## 6. Losses and performance

- **Iron loss**: `p = (c_h·f + c_e·f²)·B²` [W/kg] per steel grade. Build factors are 1.8 for teeth and 1.5 for the yoke.
- **Friction and windage**: `P_fw = 10·D·(L + 0.6τ)·v²`.
- **Stray load loss**: IEC 60034-2-1 assigned value `P_LL = (0.025 − 0.005·log₁₀(P/kW))·P_in` for induction machines, and 0.5 % for synchronous machines.
- **Induction machine**: T-equivalent circuit.
  - Rated slip is solved so that the shaft power equals Pₙ.
  - Direct-on-line curve over slip 1 → 0.
  - Inverter envelope at I_max = overload × Iₙ with V/f control, IR boost and field weakening.
  - Efficiency map with frequency-adaptive slip.
- **PM and wound-field machines**: dq model `T = (m/2)·p·[ψ·i_q + (L_d − L_q)·i_d·i_q]`, with
  - `v_d = R·i_d − ω·L_q·i_q`
  - `v_q = R·i_q + ω·(L_d·i_d + ψ)`

  The rated point is the minimum-current solution within the voltage limit. The capability is the maximum torque on a grid of current angle, current amplitude and (for wound field) field flux, with |i| ≤ I_max and |v| ≤ √2·V_ph. The efficiency map uses minimum-loss solutions. The load-angle curve uses `T(δ) = (m/ω_m)·[V·E₀/X_d·sin δ + V²/2·(1/X_q − 1/X_d)·sin 2δ]`.

## 7. Surface-PM Vernier machine (Vernier tab)

A single slotted stator carries a P_s-pole-pair winding, and the rotor carries P_r pole pairs of surface magnets.

- **Pole-pair rule**: P_r = N_s − P_s (the working field rotates against the rotor) or P_r = N_s + P_s.
- **Gear ratio**: G = P_r / P_s. **Electrical frequency**: f_e = P_r·n/60.
- **Slot permeance** (Zhu & Howe, IEEE Trans. Magn. 1993, Part III), relative to μ0/g' with g' = g + h_m/μ_r and ε = b₀/τ_s:

      λ(θ) = λ₀ + Σ λ_n cos(n N_s θ)
      β = ½ − 1/(2√(1 + (b₀/2g')²))
      λ₀ = (1/k_C)(1 − 1.6 β ε)
      λ_n = −(4/nπ) β · 0.78125 sin(1.6π n ε) / (0.78125 − 2 (n ε)²)

  The removable singularity at nε = 0.625 is replaced by its limit.
- **Rotor field** (slotless): B_m = k_l B_r (h_m/μ_r)/(h_m/μ_r + g), with fundamental B_r1 = (4/π) B_m sin(α_m π/2) at order P_r.
- **Gap components**:
  - direct: B_Pr = B_r1 λ₀
  - working: B_Ps = ½ B_r1 |λ₁| at order |P_r − N_s| = P_s
  - side-bands at |P_r + j N_s|
- **Winding factors**: the direct order P_r = N_s ∓ P_s is a slot harmonic of the winding, so k_w(P_r) = k_w(P_s).
- **EMF**: `E = √2 π f_e N D L (k_w B_Ps/P_s + k_w B_Pr/P_r)`, so E_Ps/E_Pr = G B_Ps/B_Pr. Turns follow from the EMF target.
- **Torque** (with A the rms electric loading): `T = (π/4) D² L √2 A (k_w G B_Ps + k_w B_Pr)`. This equals m E I / ω_m, and B_eff = G B_Ps + B_Pr acts as the effective gap flux density.
- **Synchronous inductance**: magnetising inductance of the P_s wave across δ_ef = k_C g + h_m/μ_r, plus slot and differential leakage.
- **Power factor** (i_d = 0): PF = ψ_m / √(ψ_m² + (L_s Î)²). It falls as G rises, so size the inverter for S = P/(PF·η).
- **Slot-opening sweep**: modulation (|λ₁|) rises with ε while the mean permeance (1/k_C) falls, giving a torque optimum at intermediate ε.
- **Limits**: the model uses one slot harmonic and a slotless magnet field, and ignores tooth-tip saturation and rotor leakage between the many poles, so it overestimates torque. Confirm with FEA.

## 8. Checks

Checks flag:

- tooth and yoke flux densities
- fill factor and unreachable slot area
- J, ac, B_av and L/τ ranges
- peripheral speed (sleeve needed above about 40 m/s for SPM)
- k_w1 and winding balance
- parallel paths
- calculated versus assumed η and PF
- cage slot combinations
- starting and breakdown torque ratios
- magnet working point
- voltage requirement
- pull-out ratio
- field coil space
- shaft fit (35 MPa torsion)

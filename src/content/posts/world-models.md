---
title: "World Models"
excerpt: "My working notes on world models: latent dynamics and planning, what renderers, simulators and planners need from them, how JEPA learns without collapsing, and how VLAs, world models and world-action models (WAMs) relate."
date: 2026-11-16
topic: "Machine learning"
media: "[Cover: an observation encoded into a latent and rolled forward under actions, ẑ(t+1) = f_θ(z_t, a_t)]"
image: "/media/world-models-cover.png"
---

## Latent dynamics model

$$
\hat{z}_{t+1} = f_\theta(z_t, a_t)
$$

### Long imagined rollout

$$
\hat{z}_{t+2} = f_\theta(\hat{z}_{t+1}, a_{t+1})
$$

$$
\hat{z}_{t+n} = f_\theta(\hat{z}_{t+n-1}, a_{t+n-1})
$$

## Three types of outputs

1. **Renderers** → observations
   - partial, noisy view (camera image)
   - → *visual fidelity*
2. **Simulator** → state
   - full description of the world (velocity, position, mountain shape)
   - → *structural fidelity (faithful)*
3. **Planners** → actions
   - → *structural fidelity (faithful)*

### Planners

$$
a_t^* = \arg\min_{a_t} C(z_t, a_t, z_g)
$$

- $a_t^*$ → optimal action (gives the action that achieves the smallest cost)
- $\arg\min_{a_t}$ → search over all possible $a_t$
- $\min$ → the minimum value of the cost
- Common cost choice:

$$
C(z_t, a_t, z_g) = \lVert f_\theta(z_t, a_t) - z_g \rVert^2
$$

## Simulator: the bridge between rendering and planning

[![Diagram: the simulator feeds both rendering (visual observations) and planning (action-conditioned features).](/media/world-models-simulator-bridge.png)](/media/world-models-simulator-bridge.png)

- Simulator → structural substrate from which both visual obs & action-conditioned features can be derived.

> **Bottleneck:** scarce data for explicit 3D, material, physical & robot interaction data. 3D assets can look plausible but could still contain scale errors, self-intersections or physically invalid structure.

- **Open question:** How can these data be collected?

### Idea: material-aware planning

- From an image, predict the material, texture, stiffness.
- Adjust the policy based on the newly predicted information, like humans do.
- Example: image → soft material, slippery →

$$
a_t^* = \arg\min_{a_t} C(z_t, a_t, m_t, z_g)
$$

- $m_t$ → material properties

## Unified world model

[![Diagram: renderer (interpretable observations), simulator (maintains and evolves the world state) and planner (selects actions by evaluating the predicted future) all connect to one unified world model.](/media/world-models-unified.png)](/media/world-models-unified.png)

- Projections of the same underlying problem:
  - learning the structure of space, time, objects, dynamics & agency.

## JEPA (Joint-Embedding Predictive Architecture)

- Learn by predicting the **embedding** of one signal from another compatible signal.
- It learns an **encoder** and a **predictor**.

### Core equations

$$
s_x = f_\theta(x) \qquad s_y = f_{\bar\theta}(y)
$$

$$
\hat{s}_y = g_\phi(s_x, z)
$$

- $\bar\theta$ → slowly-updated copy of the encoder weights $\theta$
- $z$ → extra information

Optimize a latent prediction loss:

$$
\mathcal{L}_{\text{JEPA}} = \lVert \hat{s}_y - s_y \rVert_2^2
$$

- → squared distance

### Example: image patches

- $x$ → visible patch of the image → $s_x = f_\theta(x)$
- $y$ → hidden patch → $s_y = f_{\bar\theta}(y)$
- $z$ → where the hidden patch is
- $\hat{s}_y = g_\phi(s_x, z)$ → guess for the hidden patch embedding

### Target encoder update (EMA)

$$
\bar\theta_t = \tau\,\bar\theta_{t-1} + (1-\tau)\,\theta_t
$$

- → exponentially moving average
- $\bar\theta_{t-1}$ → old target weights
- $\theta_t$ → current main weights
- $\tau$ → how much to keep the old value, usually 0.996 – 0.999

### Four components of JEPA

1. **Encoder**: map input (obs) → latent
2. **Target encoder**: map target → latent
   - updated by EMA
3. **Predictor**: maps
   - context representation
   - target-position tokens
   - temporal tokens
   - action embeddings
   - → usually a small transformer
4. **Anti-collapse mechanism**

### Variants

|             | Query hint   | Predicts               |
| ----------- | ------------ | ---------------------- |
| I-JEPA      | where        | hidden patch embedding |
| V-JEPA      | where + when | masked video part      |
| World model | action       | next state embedding   |

### Generative vs JEPA world model

- **Generative** → predicts the next observation itself (pixels):

$$
\mathcal{L} = -\log p_\theta(o_{t+1} \mid o_{\le t}, a_{\le t})
$$

- **JEPA** → predicts the next observation's embedding:

$$
\mathcal{L} = \lVert g_\phi(f_\theta(o_{\le t}), a_t) - f_{\bar\theta}(o_{t+1}) \rVert_2^2
$$

### Anti-collapse

#### 1. EMA + stop-gradient asymmetry

[![Diagram: x goes through the context encoder and y through the target encoder. The predictor takes s_x and z and outputs ŝ_y, which is compared with s_y in D(ŝ_y, s_y). The context encoder and predictor are updated by backpropagation; the target encoder is updated only by EMA from the context encoder, with a stop-gradient.](/media/world-models-ema-stop-gradient.png)](/media/world-models-ema-stop-gradient.png)

- **Online branch** (context encoder + predictor) → updated by backpropagation
- **Target encoder** → no backprop; updated only by EMA + stop-gradient

#### 2. Explicit regularization

- Explicit regularization constrains the **geometry** & **distribution** of the embeddings.
- **Geometry** → where is each point (embedding vector) relative to another vector?
  - distance
  - angle
  - cluster
  - dimensions
  - separability
  - structure
- **Distribution** → what is the overall statistical behaviour of all these points?
  - average value of each dimension
  - how each dimension varies
  - are dimensions correlated? (one affects the other)
  - are values concentrated at zero?
  - does the distribution resemble a Gaussian?
  - is the distribution isotropic? (similar in every direction)

$$
\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{predictor}} + \lambda\,\mathcal{L}_{\text{regularization}}
$$

- $\mathcal{L}_{\text{predictor}}$ → encourage the prediction to match the target representation
- $\lambda$ → strength of the regularizer
- $\mathcal{L}_{\text{regularization}}$ → penalize an undesired latent space

##### VICReg: Variance-Invariance-Covariance Regularization

Three objectives:

1. **Invariance** → two different views of the same input should have similar representations.

$$
\mathcal{L}_{\text{inv}} = \frac{1}{N}\sum_i \lVert z_i - z_i' \rVert^2
$$

2. **Variance** → each embedding dimension should have enough variation across the batch.

$$
\mathcal{L}_{\text{var}} = \frac{1}{d}\sum_j \max\big(0,\ \gamma - \operatorname{std}(z_j)\big)
$$

- $\gamma$ → minimum desired standard deviation

3. **Covariance** → push the off-diagonal covariances to zero (decorrelate the dimensions).

$$
\mathcal{L}_{\text{cov}} = \frac{1}{d}\sum_{i \ne j} C_{ij}^2
$$

- $C$ → covariance matrix

##### SIGReg: Sketched Isotropic Gaussian Regularization

- Tries to make the overall embedding distribution resemble an isotropic Gaussian:

$$
z \sim \mathcal{N}(0, I)
$$

##### Other regularizers

- variance constraint
- covariance constraint
- Gaussian matching
- norm regularization
- orthogonality
- uniformity
- entropy regularization
- contrastive regularization

### Training a JEPA world model: collapse prevention

- **Best strategy: information maximization**
  - SIGReg, VICReg, Barlow Twins
  - MMCR, MCR², W-MSE
- **Distillation**
  - DINO, I-JEPA, V-JEPA

[![Diagram: x goes through the context encoder Enc(x) to s_x, and y through the target encoder Enc(y) to s_y. The predictor g_ϕ(s_x, z), also fed by a, outputs ŝ_y, and D(ŝ_y, s_y) is minimized as the prediction error. Both s_x and s_y also feed −I(s_x) and −I(s_y), which maximize information content.](/media/world-models-information-maximization.png)](/media/world-models-information-maximization.png)

- Minimize the prediction error $D(\hat s_y, s_y)$.
- At the same time, maximize the information content of both embeddings: $-I(s_x)$ and $-I(s_y)$.

> **How do you measure the information content?**
>
> - We need a cost function that is a **differentiable** measure of information, so we can backpropagate the gradient and maximize it.
> - **Bad news:** we don't have objective measures of information content. All the proper definitions assume we know the distribution of the vectors (or whatever we want to measure).
> - We don't know the distribution; we only have samples coming out of the encoder. So how do you compute information content from a finite number of samples?
> - **Second problem:** to maximize something, we need a **lower bound** on information content, so that pushing the bound up pushes the actual information up. But every empirical measure we have is an **upper bound**. Currently we come up with a good upper bound and cross our fingers.

## VLA, WAM & WM

[![Diagram: three panels. VLA takes the current observation o_t and language L and outputs an action A (a policy model). WAM takes o_t and L and outputs both the next observation o_t+1 and an action A (policy plus dynamics). WM takes o_t and an action A and outputs the next observation o_t+1 (a predictive dynamics model).](/media/world-models-vla-wam-wm.png)](/media/world-models-vla-wam-wm.png)

- **VLA** → primarily a policy model
- **WM** → primarily a predictive dynamics model
- Combine these → **WAM**

**WAM vs other concepts:** WAM and video policy are two overlapping circles, and VAM sits inside the overlap (it is both).

[![Diagram: two overlapping circles, WAM and video policy, with VAM in the overlap.](/media/world-models-wam-venn.png)](/media/world-models-wam-venn.png)

### VLA: conditional action distribution

$$
p_\theta(a_t \mid o_t, L)
$$

Imitation learning objective:

$$
\mathcal{L}_{\text{VLA}} = \mathbb{E}_{(o_t, L, a_t)\sim \mathcal{D}}\big[-\log p_\theta(a_t \mid o_t, L)\big]
$$

### WM: conditional future-state distribution

$$
p_\phi(o_{t+1} \mid o_t, a_t)
$$

or in latent space:

$$
p_\phi(z_{t+1} \mid z_t, a_t), \qquad z_t = f_\theta(o_{\le t})
$$

- $z_t$ → compact latent
- Primary role: support imagination, simulation, prediction, planning or representation learning.

Learning objective:

$$
\mathcal{L}_{\text{WM}} = \mathbb{E}_{(o_t, a_t, o_{t+1})\sim \mathcal{D}}\big[-\log p_\phi(o_{t+1} \mid o_t, a_t)\big]
$$

or latent transition loss:

$$
\mathcal{L}_{\text{WM}} = \mathbb{E}\big[-\log p_\phi(z_{t+1} \mid z_t, a_t)\big]
$$

### WAM: joint state-action distribution

$$
p_\psi(o_{t+1}, a_t \mid o_t, L)
$$

Objective function:

$$
\mathcal{L}_{\text{WAM}} = \mathbb{E}_{(o_t, L, o_{t+1}, a_t)\sim \mathcal{D}}\big[-\log p_\psi(o_{t+1}, a_t \mid o_t, L)\big]
$$

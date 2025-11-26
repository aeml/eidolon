EIDOLON: The World & Narrative Design

1. High Concept

Eidolon is an Isometric Action-RPG set in Aethelgard, a realm where physical reality is a direct projection of the Collective Consciousness.

The world has fallen into Dissonance. A parasitic frequency known as the Umbra has distorted the world, turning lush landscapes into jagged, grey wastelands and noble guardians into twisted tyrants.

The Player is a Harmonizer. You do not kill to conquer; you fight to re-tune. You strip away the corruption to find the "Eidolon" (the ideal form) hidden underneath.

2. The Core Loop: The "Restoration" Mechanic

The narrative is strictly tied to the Asset Manager and World State.

Phase A: The Dissonance (The Wasteland)

Narrative State: The Umbra is dominant. The region is rejected by the World Soul.

Visuals: Desaturated colors, low-poly jagged geometry, grey fog, aggressive ambient noise.

Gameplay: Hostile survival. Enemies are "Hollows" (mindless geometry). High risk, low resource regeneration.

Phase B: The Catharsis (The Boss Fight)

The Conflict: You confront a Fallen Paragon. You are not trying to execute them; you are breaking the "Armor of Dissonance" encasing them.

Visual Cues: As the boss takes damage, the black shell cracks, revealing blinding light (the true self) underneath.

Phase C: The Resonance (The Lush World)

Narrative State: The Paragon is "Re-integrated." The region harmonizes.

Visuals: Immediate, real-time transition. High-fidelity models load in. Grass blooms, water flows, music becomes melodic.

Gameplay: The region becomes a Hub. Previously blocked paths open. Resources are abundant.

3. The Setting: Aethelgard

The world is divided into four realms, representing the Four Jungian Functions of Consciousness.

Act I: The Iron Weald (Sensation / Earth)

Theme: Physical Reality, Strength, Growth.

The Corruption: Cancerous Overgrowth & Rust. Nature has become choking and violent. Strength has become Brutality.

The Fallen Paragon: Valos, The Titan. Once a guardian of the forest, the Umbra twisted his protective nature into paranoia. He is now a fortress of thorns and iron, crushing anything that moves "for its own safety."

Restored State: A golden, sun-dappled forest where iron and wood coexist in harmony.

Act II: The Crystalline Spire (Thinking / Air)

Theme: Logic, Order, Structure.

The Corruption: Absolute Zero. Logic without empathy becomes cold calculation. The area is a frozen library of sharp, blue ice and silent clockwork.

The Fallen Paragon: Archivist Sol. Once a keeper of wisdom, now a hoarder of data. He freezes intruders to "preserve" them perfectly forever.

Restored State: A floating academy of warm light, moving bridges, and flowing wind.

Act III: The Shifting Sands (Intuition / Fire)

Theme: Possibility, Spirit, The Unknown.

The Corruption: Mirage & Deceit. Potential becomes Paranoia. The desert shifts constantly; nothing is real. Shadows attack from nowhere.

The Fallen Paragon: The Weaver. Once a guide to the future, now a deceiver who traps souls in infinite loops of "what if" scenarios.

Restored State: A mystic oasis under a starry night sky, where the path forward is always clear.

Act IV: The Abyssal Well (Feeling / Water)

Theme: Emotion, Connection, Value.

The Corruption: The Drowning. Love becomes Obsession. The region is a dark, flooded swamp where the water weighs as much as lead.

The Fallen Paragon: Lady Elara. Once the source of compassion, she now drowns the world in her grief, refusing to let anything leave her embrace.

Restored State: A bioluminescent lake city, vibrant and interconnected.

4. The Entities

The Player: The Harmonizer

Origin: You are an anomaly. A blank slate. An Archetype that has not yet chosen a form.

Motivation: To reach the Axis Mundi (The Center) and reset the world's frequency.

The Enemies: The Complex

Enemies are not biological; they are psychological fragments.

Hollows (Trash Mobs): Grey, faceless shapes. They represent fleeting negative thoughts (Anxiety, Anger, Doubt).

Constructs (Elites): More defined forms. Represents rigid habits (The Wall, The Spike).

Shadows (Mini-Bosses): Dark reflections of the Player Classes. (e.g., A "Rogue" Shadow that represents Betrayal).

5. Items & Progression: "Integration"

In Eidolon, you do not just "loot gear." You find broken memories and restore them.

Drop: Corrupted Shard (Sword).

Description: "A jagged blade heavy with malice. Drains user HP."

Action: Take it to the Refinery (Blacksmith).

Result: Harmonic Blade.

Description: "The malice has been tempered into resolve. Restores HP on hit."

Philosophy: This mirrors the Shadow Work concept—taking a negative trait (like aggression) and refining it into a positive one (assertiveness).

6. The "Greybox" Lore Explanation

(To be used during early development or low-detail settings)

The Deep Subconscious:
Before you reach the surface of Aethelgard, you must traverse the Primordial Layer.

Lore: This is the basement of reality. Here, forms have not yet chosen their skin.

Visuals: The "Greybox" prototype art style (Cubes, Cylinders, Grids).

Narrative: "The Umbra has eaten the very texture of this place. Only the geometry remains. We must climb higher to restore the color."

7. Technical/Narrative Synergy

Narrative Element

Technical System

The Harmonizer

The PlayerController class.

The Dissonance

The ZoneManager loading _corrupt asset bundles.

The Resonance

The ZoneManager swapping to _lush asset bundles.

Hollows

InstancedMesh usage (hordes of identical, simple geometry).

Paragon Armor Break

Destruction physics / swapping mesh parts from "Armored" to "Exposed."

8. Asset Generation Prompts (AI / Meshy)

Use these prompts to generate the base GLB models. These are designed as base bodies (underlayers only) so armor and weapons can be equipped dynamically later.

The Fighter (Sensation/Earth)

Prompt: "Low poly 3D character model of a heavy muscular human base body, standing in A-pose. Style: Stylized fantasy, hand-painted texture aesthetic. Features: Wearing simple rough-spun tunic and trousers. Earthy brown and moss green fabric colors. No armor, no helmet, no weapons. Strong, grounded silhouette. Bare hands and boots."

The Wizard (Thinking/Air)

Prompt: "Low poly 3D character model of a tall slender human base body, standing in A-pose. Style: Stylized fantasy, hand-painted texture aesthetic. Features: Wearing simple linen under-robes or plain tunic. Ice blue and white fabric colors. No heavy cloaks, no staff, no accessories. Clean vertical silhouette. Bare hands and soft shoes."

The Rogue (Intuition/Fire)

Prompt: "Low poly 3D character model of an athletic wiry human base body, standing in A-pose. Style: Stylized fantasy, hand-painted texture aesthetic. Features: Wearing tight-fitting dark base layers and foot wraps. Burnt orange and deep purple fabric colors. Face visible (no cowl/hood). No daggers, no belts, no armor. Agile silhouette."

The Cleric (Feeling/Water)

Prompt: "Low poly 3D character model of a soft-featured human base body, standing in A-pose. Style: Stylized fantasy, hand-painted texture aesthetic. Features: Wearing a plain, unadorned gown or vestment. Deep ocean blue and teal fabric colors. No religious symbols, no staff, no heavy robes. Smooth, curved silhouette. Bare hands."
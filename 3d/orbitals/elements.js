/* ============================================================================
 * elements.js - Bohr-mock element database for ChemReact AR
 * ----------------------------------------------------------------------------
 * Loaded as a CLASSIC <script> tag. No ES module imports/exports.
 * Assigns to window.BOHR_ELEMENTS so the page-global Bohr factory can read it:
 *
 *     <script src="./3d/orbitals/_drafts/elements.js"></script>
 *     <script>
 *       const atom = buildBohrAtom(window.BOHR_ELEMENTS['C'], scene);
 *     </script>
 *
 * The generic buildBohrAtom(elementData, ...) factory accepts ANY of these
 * records and renders shells/electrons/nucleus from the pre-computed fields.
 *
 * ----------------------------------------------------------------------------
 * SCHEMA (every record):
 *   z              proton count (= atomic number)
 *   mass           atomic mass; neutron count = round(mass - z)
 *   name           full element name
 *   config         raw electron-config string from NCERT/IUPAC
 *   cpkColor       standard CPK hex; used for ring + electron tinting
 *   period, group  periodic-table coords
 *   category       'nonmetal' | 'noble' | 'alkali-metal' | 'alkaline-earth'
 *                  | 'metalloid' | 'halogen' | 'transition' | 'post-transition'
 *   shellCounts    [K, L, M, N, ...] occupants per principal shell.
 *                  Sum equals z (neutral atom). Bohr-style flattening of d/f
 *                  blocks: e.g. Fe -> [2,8,14,2], Cu -> [2,8,18,1].
 *   valenceShell   shellCounts.length (n-index of outermost shell)
 *   valenceCount   shellCounts[shellCounts.length - 1]
 *   energyLevels   E_n in eV per occupied shell.
 *                  E_n = -13.6 * Z_eff^2 / n^2
 *                  Z_eff approximations (Slater-ish, lightweight):
 *                    n=1: Z - 0.31
 *                    n=2: Z - 4.15
 *                    n=3: Z - 11.25
 *                    n=4: Z - 21.0
 *                    n=5: Z - 35.0   (extension for Ag)
 *                    n=6: Z - 60.0   (extension for Au, Hg, Pb)
 *   facts          1-3 pedagogy strings
 *   commonReactions 1-3 simple element-level reactions (optional)
 *
 * Coverage: 28 elements (25 required + Au, Hg, Pb bonus).
 * Skipped from elements.json: I, Ba (not in required/bonus list).
 * ============================================================================
 */

window.BOHR_ELEMENTS = {

  'H': {
    z: 1, mass: 1.008, name: 'Hydrogen',
    config: '1s1', cpkColor: '#FFFFFF',
    period: 1, group: 1, category: 'nonmetal',
    shellCounts: [1], valenceShell: 1, valenceCount: 1,
    energyLevels: [-6.43],
    facts: ['Lightest element in the universe.', 'Makes up ~75% of all normal matter.', 'Burns with a pale blue flame.'],
    commonReactions: ['2H + O -> H2O', 'H + Cl -> HCl', '3H + N -> NH3']
  },

  'He': {
    z: 2, mass: 4.003, name: 'Helium',
    config: '1s2', cpkColor: '#D9FFFF',
    period: 1, group: 18, category: 'noble',
    shellCounts: [2], valenceShell: 1, valenceCount: 2,
    energyLevels: [-38.04],
    facts: ['Second most abundant element in the universe.', 'Inert - refuses to bond with anything.', 'Voice goes squeaky because sound moves faster in helium.'],
    commonReactions: []
  },

  'Li': {
    z: 3, mass: 6.94, name: 'Lithium',
    config: '[He]2s1', cpkColor: '#CC80FF',
    period: 2, group: 1, category: 'alkali-metal',
    shellCounts: [2, 1], valenceShell: 2, valenceCount: 1,
    energyLevels: [-98.41, -7.22],
    facts: ['Lightest metal - floats on oil.', 'Powers your phone battery.', 'Burns crimson red.'],
    commonReactions: ['2Li + 2H2O -> 2LiOH + H2', '4Li + O2 -> 2Li2O']
  },

  'Be': {
    z: 4, mass: 9.012, name: 'Beryllium',
    config: '[He]2s2', cpkColor: '#C2FF00',
    period: 2, group: 2, category: 'alkaline-earth',
    shellCounts: [2, 2], valenceShell: 2, valenceCount: 2,
    energyLevels: [-187.10, -0.07],
    facts: ['Lighter than aluminium, stiffer than steel.', 'Toxic dust - handle with care.', 'Used in James Webb Telescope mirrors.'],
    commonReactions: ['2Be + O2 -> 2BeO', 'Be + Cl2 -> BeCl2']
  },

  'B': {
    z: 5, mass: 10.81, name: 'Boron',
    config: '[He]2s2 2p1', cpkColor: '#FFB5B5',
    period: 2, group: 13, category: 'metalloid',
    shellCounts: [2, 3], valenceShell: 2, valenceCount: 3,
    energyLevels: [-298.83, -2.55],
    facts: ['Borax is found in deserts and washing powder.', 'Forms cage-shaped molecules called boranes.', 'Hardest element after carbon and tungsten.'],
    commonReactions: ['4B + 3O2 -> 2B2O3', '2B + 3Cl2 -> 2BCl3']
  },

  'C': {
    z: 6, mass: 12.011, name: 'Carbon',
    config: '[He]2s2 2p2', cpkColor: '#909090',
    period: 2, group: 14, category: 'nonmetal',
    shellCounts: [2, 4], valenceShell: 2, valenceCount: 4,
    energyLevels: [-433.92, -11.54],
    facts: ['Basis of all known life.', 'Same atom in pencil lead and diamond - just arranged differently.', 'Forms more compounds than any other element.'],
    commonReactions: ['C + O2 -> CO2', '2C + O2 -> 2CO', 'C + 2H2 -> CH4']
  },

  'N': {
    z: 7, mass: 14.007, name: 'Nitrogen',
    config: '[He]2s2 2p3', cpkColor: '#3050F8',
    period: 2, group: 15, category: 'nonmetal',
    shellCounts: [2, 5], valenceShell: 2, valenceCount: 5,
    energyLevels: [-593.32, -27.21],
    facts: ['78% of the air you breathe.', 'Liquid nitrogen freezes things instantly.', 'Triple bond - one of the strongest in chemistry.'],
    commonReactions: ['N2 + 3H2 -> 2NH3', 'N2 + O2 -> 2NO']
  },

  'O': {
    z: 8, mass: 15.999, name: 'Oxygen',
    config: '[He]2s2 2p4', cpkColor: '#FF0D0D',
    period: 2, group: 16, category: 'nonmetal',
    shellCounts: [2, 6], valenceShell: 2, valenceCount: 6,
    energyLevels: [-776.04, -49.74],
    facts: ['You need it every few seconds to live.', 'Makes things rust, burn, and breathe.', 'Liquid form is pale blue.'],
    commonReactions: ['2H + O -> H2O', '2Fe + O2 -> 2FeO', 'C + O2 -> CO2']
  },

  'F': {
    z: 9, mass: 18.998, name: 'Fluorine',
    config: '[He]2s2 2p5', cpkColor: '#90E050',
    period: 2, group: 17, category: 'halogen',
    shellCounts: [2, 7], valenceShell: 2, valenceCount: 7,
    energyLevels: [-983.00, -78.40],
    facts: ['Most reactive element on the periodic table.', 'Reacts even with glass and water.', 'Toothpaste version (fluoride) is safe - pure fluorine is not.'],
    commonReactions: ['H2 + F2 -> 2HF', '2Na + F2 -> 2NaF']
  },

  'Ne': {
    z: 10, mass: 20.180, name: 'Neon',
    config: '[He]2s2 2p6', cpkColor: '#B3E3F5',
    period: 2, group: 18, category: 'noble',
    shellCounts: [2, 8], valenceShell: 2, valenceCount: 8,
    energyLevels: [-1213.97, -114.04],
    facts: ['Glows red-orange in signs.', 'Completely unreactive.', 'Found in trace amounts in air.'],
    commonReactions: []
  },

  'Na': {
    z: 11, mass: 22.990, name: 'Sodium',
    config: '[Ne]3s1', cpkColor: '#AB5CF2',
    period: 3, group: 1, category: 'alkali-metal',
    shellCounts: [2, 8, 1], valenceShell: 3, valenceCount: 1,
    energyLevels: [-1469.20, -156.81, -0.07],
    facts: ['Soft enough to cut with a knife.', 'Explodes in water with a yellow flame.', 'Half of table salt and street lamps.'],
    commonReactions: ['2Na + Cl2 -> 2NaCl', '2Na + 2H2O -> 2NaOH + H2']
  },

  'Mg': {
    z: 12, mass: 24.305, name: 'Magnesium',
    config: '[Ne]3s2', cpkColor: '#8AFF00',
    period: 3, group: 2, category: 'alkaline-earth',
    shellCounts: [2, 8, 2], valenceShell: 3, valenceCount: 2,
    energyLevels: [-1748.43, -207.01, -0.85],
    facts: ['Burns with a blinding white flame.', 'Used in old-school camera flashes.', 'Lightest structural metal.'],
    commonReactions: ['2Mg + O2 -> 2MgO', 'Mg + Cl2 -> MgCl2']
  },

  'Al': {
    z: 13, mass: 26.982, name: 'Aluminium',
    config: '[Ne]3s2 3p1', cpkColor: '#BFA6A6',
    period: 3, group: 13, category: 'post-transition',
    shellCounts: [2, 8, 3], valenceShell: 3, valenceCount: 3,
    energyLevels: [-2051.66, -262.81, -3.50],
    facts: ['Most abundant metal in Earth\'s crust.', 'Forms an invisible oxide layer that resists rust.', 'Once worth more than gold.'],
    commonReactions: ['4Al + 3O2 -> 2Al2O3', '2Al + 3Cl2 -> 2AlCl3']
  },

  'Si': {
    z: 14, mass: 28.085, name: 'Silicon',
    config: '[Ne]3s2 3p2', cpkColor: '#F0C8A0',
    period: 3, group: 14, category: 'metalloid',
    shellCounts: [2, 8, 4], valenceShell: 3, valenceCount: 4,
    energyLevels: [-2378.89, -324.21, -8.30],
    facts: ['Foundation of all computer chips.', 'Beach sand is mostly silicon dioxide.', 'Second most abundant element in Earth\'s crust.'],
    commonReactions: ['Si + O2 -> SiO2', 'Si + 2Cl2 -> SiCl4']
  },

  'P': {
    z: 15, mass: 30.974, name: 'Phosphorus',
    config: '[Ne]3s2 3p3', cpkColor: '#FF8000',
    period: 3, group: 15, category: 'nonmetal',
    shellCounts: [2, 8, 5], valenceShell: 3, valenceCount: 5,
    energyLevels: [-2730.12, -391.21, -14.81],
    facts: ['White phosphorus glows in the dark and burns spontaneously.', 'Essential in DNA, ATP, and bones.', 'Strike-anywhere matches use red phosphorus.'],
    commonReactions: ['4P + 5O2 -> 2P2O5', '2P + 3Cl2 -> 2PCl3']
  },

  'S': {
    z: 16, mass: 32.06, name: 'Sulfur',
    config: '[Ne]3s2 3p4', cpkColor: '#FFFF30',
    period: 3, group: 16, category: 'nonmetal',
    shellCounts: [2, 8, 6], valenceShell: 3, valenceCount: 6,
    energyLevels: [-3105.35, -463.81, -23.04],
    facts: ['The brimstone of ancient texts.', 'Smells like rotten eggs in compounds.', 'Yellow crystal - easy to spot.'],
    commonReactions: ['S + O2 -> SO2', '2S + 3O2 -> 2SO3', 'Fe + S -> FeS']
  },

  'Cl': {
    z: 17, mass: 35.45, name: 'Chlorine',
    config: '[Ne]3s2 3p5', cpkColor: '#1FF01F',
    period: 3, group: 17, category: 'halogen',
    shellCounts: [2, 8, 7], valenceShell: 3, valenceCount: 7,
    energyLevels: [-3504.58, -542.01, -33.04],
    facts: ['Pungent yellow-green gas.', 'Kills bacteria - keeps swimming pools safe.', 'Half of table salt.'],
    commonReactions: ['H2 + Cl2 -> 2HCl', '2Na + Cl2 -> 2NaCl']
  },

  'Ar': {
    z: 18, mass: 39.948, name: 'Argon',
    config: '[Ne]3s2 3p6', cpkColor: '#80D1E3',
    period: 3, group: 18, category: 'noble',
    shellCounts: [2, 8, 8], valenceShell: 3, valenceCount: 8,
    energyLevels: [-3927.81, -625.81, -45.04],
    facts: ['1% of the air around you.', 'Inert - fills incandescent bulbs to stop the filament burning.', 'Name means "lazy" in Greek.'],
    commonReactions: []
  },

  'K': {
    z: 19, mass: 39.098, name: 'Potassium',
    config: '[Ar]4s1', cpkColor: '#8F40D4',
    period: 4, group: 1, category: 'alkali-metal',
    shellCounts: [2, 8, 8, 1], valenceShell: 4, valenceCount: 1,
    energyLevels: [-4375.04, -715.21, -58.79, -0.06],
    facts: ['Reacts violently with water - produces lilac flame.', 'Critical for nerve signals in your body.', 'Found in bananas (very small amount).'],
    commonReactions: ['2K + 2H2O -> 2KOH + H2', '2K + Cl2 -> 2KCl']
  },

  'Ca': {
    z: 20, mass: 40.078, name: 'Calcium',
    config: '[Ar]4s2', cpkColor: '#3DFF00',
    period: 4, group: 2, category: 'alkaline-earth',
    shellCounts: [2, 8, 8, 2], valenceShell: 4, valenceCount: 2,
    energyLevels: [-4846.27, -810.21, -74.04, -0.21],
    facts: ['99% of the calcium in your body is in bones and teeth.', 'Limestone, chalk, and marble are calcium compounds.', 'Burns with a brick-red flame.'],
    commonReactions: ['2Ca + O2 -> 2CaO', 'Ca + 2H2O -> Ca(OH)2 + H2']
  },

  'Fe': {
    z: 26, mass: 55.845, name: 'Iron',
    config: '[Ar]3d6 4s2', cpkColor: '#E06633',
    period: 4, group: 8, category: 'transition',
    shellCounts: [2, 8, 14, 2], valenceShell: 4, valenceCount: 2,
    energyLevels: [-8581.65, -1496.21, -240.79, -3.40],
    facts: ['The core of Earth is mostly iron.', 'Carries oxygen in your blood.', 'Rusts when exposed to oxygen and water.'],
    commonReactions: ['4Fe + 3O2 -> 2Fe2O3', 'Fe + S -> FeS', 'Fe + 2HCl -> FeCl2 + H2']
  },

  'Cu': {
    z: 29, mass: 63.546, name: 'Copper',
    config: '[Ar]3d10 4s1', cpkColor: '#C88033',
    period: 4, group: 11, category: 'transition',
    shellCounts: [2, 8, 18, 1], valenceShell: 4, valenceCount: 1,
    energyLevels: [-10744.69, -1900.21, -340.04, -8.50],
    facts: ['First metal smelted by humans.', 'Conducts electricity better than anything except silver.', 'Turns green when it weathers (Statue of Liberty).'],
    commonReactions: ['2Cu + O2 -> 2CuO', 'Cu + Cl2 -> CuCl2']
  },

  'Zn': {
    z: 30, mass: 65.38, name: 'Zinc',
    config: '[Ar]3d10 4s2', cpkColor: '#7D80B0',
    period: 4, group: 12, category: 'transition',
    shellCounts: [2, 8, 18, 2], valenceShell: 4, valenceCount: 2,
    energyLevels: [-11503.92, -2042.81, -375.79, -10.84],
    facts: ['Galvanized steel is coated in zinc to stop rust.', 'Essential for your immune system.', 'Old pennies are mostly zinc.'],
    commonReactions: ['2Zn + O2 -> 2ZnO', 'Zn + 2HCl -> ZnCl2 + H2']
  },

  'Br': {
    z: 35, mass: 79.904, name: 'Bromine',
    config: '[Ar]3d10 4s2 4p5', cpkColor: '#A62929',
    period: 4, group: 17, category: 'halogen',
    shellCounts: [2, 8, 18, 7], valenceShell: 4, valenceCount: 7,
    energyLevels: [-15489.07, -2811.61, -566.04, -32.64],
    facts: ['Only nonmetal liquid at room temperature.', 'Deep red-brown color.', 'Name means "stench" in Greek.'],
    commonReactions: ['H2 + Br2 -> 2HBr', '2Na + Br2 -> 2NaBr']
  },

  'Ag': {
    z: 47, mass: 107.868, name: 'Silver',
    config: '[Kr]4d10 5s1', cpkColor: '#C0C0C0',
    period: 5, group: 11, category: 'transition',
    shellCounts: [2, 8, 18, 18, 1], valenceShell: 5, valenceCount: 1,
    energyLevels: [-28665.51, -5407.81, -1198.79, -109.04, -1.96],
    facts: ['Best electrical conductor of any element.', 'Tarnishes black when it meets sulfur in air.', 'Used in mirrors and old film photography.'],
    commonReactions: ['2Ag + S -> Ag2S', '4Ag + O2 -> 2Ag2O']
  },

  'Au': {
    z: 79, mass: 196.967, name: 'Gold',
    config: '[Xe]4f14 5d10 6s1', cpkColor: '#FFD123',
    period: 6, group: 11, category: 'transition',
    shellCounts: [2, 8, 18, 32, 18, 1], valenceShell: 6, valenceCount: 1,
    energyLevels: [-83571.21, -16830.41, -3960.79, -445.04, -26.46, -4.91],
    facts: ['Doesn\'t tarnish - hence its use in jewelry for millennia.', 'Almost all the gold ever mined still exists.', 'Forged inside neutron star collisions.'],
    commonReactions: ['2Au + 3Cl2 -> 2AuCl3']
  },

  'Hg': {
    z: 80, mass: 200.592, name: 'Mercury',
    config: '[Xe]4f14 5d10 6s2', cpkColor: '#B8B8D0',
    period: 6, group: 12, category: 'transition',
    shellCounts: [2, 8, 18, 32, 18, 2], valenceShell: 6, valenceCount: 2,
    energyLevels: [-85820.45, -17323.81, -4097.04, -465.84, -28.56, -5.44],
    facts: ['Only metal liquid at room temperature.', 'Toxic - used to be in thermometers and felt hats (Mad Hatter).', 'Beads up because of high surface tension.'],
    commonReactions: ['2Hg + O2 -> 2HgO', 'Hg + S -> HgS']
  },

  'Pb': {
    z: 82, mass: 207.200, name: 'Lead',
    config: '[Xe]4f14 5d10 6s2 6p2', cpkColor: '#575961',
    period: 6, group: 14, category: 'post-transition',
    shellCounts: [2, 8, 18, 32, 18, 4], valenceShell: 6, valenceCount: 4,
    energyLevels: [-90342.93, -18316.61, -4371.04, -508.24, -32.81, -6.55],
    facts: ['Toxic - banned in paint and pipes.', 'Stops X-rays - used in shielding.', 'Romans used it for water pipes.'],
    commonReactions: ['2Pb + O2 -> 2PbO', 'Pb + 2HCl -> PbCl2 + H2']
  }

};

import type { Check, Item, Section, ShowIf } from "./types";

const V = (id: string, label: string, hint?: string, extra?: Partial<Item>): Item => ({
  id, label, hint, type: "voice", ...extra,
});
const C = (id: string, label: string, options: string[], extra?: Partial<Item>): Item => ({
  id, label, options, type: "choice", ...extra,
});
/** Build checklist rows: [id, label, hint?] */
const K = (prefix: string, rows: [string, string, string?][], opts?: readonly string[]): Check[] =>
  rows.map(([id, label, hint]) => ({ id: `${prefix}_${id}`, label, hint, opts }));

export const STATUS = ["Working", "Not working", "N/A", "Not sure"] as const;
export const SUPPLIED = ["Supplied", "Not supplied", "N/A", "Not sure"] as const;
export const YESNO = ["Yes", "No", "N/A", "Not sure"] as const;
/** Ticks that are disclosed as a problem and flagged on the cover of the PDF. */
export const BAD_RATINGS = ["Not working", "Not supplied", "No"];
export const UNSURE = "Not sure";

const NOT_SAIL: ShowIf = { id: "vesselType", notIn: ["Sailing vessel"] };
const SAIL: ShowIf = { id: "vesselType", in: ["Sailing vessel"] };

export const INTRO = {
  title: "Vessel condition report",
  paragraphs: [
    "Thanks for choosing Myachts Unlimited. This report tells buyers exactly what they are getting, and it protects you.",
    "Anything you disclose here is known to the buyer from the start, so it cannot be used to reopen the price after survey. Anything left out, or marked as working when it is not, can come back on you after the sale. If you are not sure, say so (“Not sure” is always allowed).",
  ],
  how: [
    "One question or one short checklist at a time. Tap 🔊 to hear a question read aloud.",
    "Tap the microphone to speak, then tap again to stop. Check the text and edit it if needed.",
    "Add photos where prompted. Your progress saves automatically, so you can close the page and come back on the same link.",
    "At the end you sign, and Brendon and you both receive a PDF.",
  ],
};

/** Brendon's wording, from the Vessel Condition & Inventory Report. */
export const DECLARATION_TEXT =
  "I confirm that the information provided in this document is accurate to the best of my knowledge at the time of completion.";

const ENGINE_HINT = "Say the make and model, current hours, date of last engine service, date of last cooling system service, and whether you have the service receipts. Say “not fitted” if she doesn’t have one.";
const SERVICE_HINT = "For each service: date, engine hours at the time, work carried out, who did it, the dealer or mechanic’s name, and whether you have the receipt. Say “none” if there is no record.";
const BATTERY_HINT = "Say the chemistry (lithium, AGM or gel), brand, capacity in amp hours, voltage (12 or 24), year installed, and whether it is working. Say “not fitted” if there isn’t one.";

export const SECTIONS: Section[] = [
  // ---------------- details ----------------
  {
    id: "details",
    title: "Your details",
    remind: "Names and email addresses are easy to mishear, so please check the text on screen.",
    items: [
      V("sellerName", "What is your full name?", "This is the name that should match the vessel registration."),
      V("sellerMobile", "What is your mobile number?", "Say the digits one at a time.", { format: "phone" }),
      V("sellerEmail", "What is your email address?", "Say it like “john dot smith at gmail dot com”.", { format: "email" }),
      V("coOwners", "Are there any other owners or decision makers, and who are they?"),
    ],
  },
  {
    id: "identity",
    title: "Vessel details",
    items: [
      V("vesselName", "What is the name of the vessel?"),
      V("make", "Who is the make or builder?"),
      V("model", "What is the model?"),
      C("vesselType", "What type of vessel is she?", ["Motor cruiser", "Flybridge", "Sailing vessel", "Other"]),
      V("vesselTypeOther", "What type of vessel is she?", undefined, { showIf: { id: "vesselType", in: ["Other"] } }),
      V("year", "What year was she built?"),
      V("hin", "What is the hull ID and registration number?", "Photograph the hull ID plate as well."),
      V("askingPrice", "What is your asking price?"),
      V("berth", "Which marina and berth is she kept at?"),
    ],
    photos: ["Hull ID plate", "Name on stern", "Bow", "Stern", "Port side", "Starboard side", "Helm station"],
  },

  // ---------------- Part A: critical ----------------
  {
    id: "critical",
    part: "Part A",
    title: "Critical pre-sale items",
    remind: "These are the items surveyors flag most and that decide whether a buyer can get insurance. Without insurance, settlement cannot proceed. Please check and fix them before listing. Note expiry dates against each one.",
    items: [],
    checks: [
      ...K("crit", [
        ["reg", "Vessel registration, current and valid", "A copy goes to the agent."],
        ["regMatch", "Registration matches the vessel description and hull ID", "Note any additional owners."],
        ["tenderReg", "Tender / dinghy registration, current and valid", "A copy goes to the agent."],
        ["insurance", "Vessel insurance, current certificate of currency", "Most haul-out and slipway facilities will not lift a vessel without one."],
        ["licence", "Copy of your current driver’s licence", "Must match the name on the registration."],
        ["epirbReg", "EPIRB registered with AMSA and in date", "Note the expiry."],
        ["epirbBatt", "EPIRB battery in date", "Note the expiry."],
        ["flares", "Flares / EVDS all in date", "Note the expiry."],
        ["pfds", "Life jackets / PFDs, correct number for vessel capacity"],
        ["liferaft", "Life raft serviced and in date", "Note last service and expiry."],
        ["gas", "Gas compliance certificate, current", "Note the expiry."],
      ], SUPPLIED),
      ...K("crit", [
        ["extinguishers", "Fire extinguishers all charged and in date", "Note last service."],
        ["suppression", "Fire suppression system, engine room, serviced and in date"],
        ["seacocks", "All seacocks and below-waterline valves operational and not seized", "A seized seacock means lifting the vessel, which is costly and slow. Note any issues."],
        ["bilgePumps", "Bilge pumps all operational", "Note the number and locations."],
        ["floatSwitches", "Bilge pump automatic float switches all operational"],
        ["bilgeAlarm", "Bilge alarm operational"],
      ], YESNO),
    ],
    photos: ["Registration", "Insurance certificate", "EPIRB", "Flares", "Fire extinguisher service tags"],
  },

  // ---------------- Part A: engines, batteries, service ----------------
  {
    id: "engines",
    part: "Part A",
    title: "Engine details",
    remind: "Buyers and surveyors look hardest at the engines. Without receipts, a buyer may treat a service as not done.",
    items: [
      V("eng_port", "Port engine (or single engine)", ENGINE_HINT),
      V("eng_stbd", "Starboard engine", ENGINE_HINT),
      V("eng_centre", "Centre engine", ENGINE_HINT),
      V("eng_drives", "Stern drives", ENGINE_HINT),
      V("eng_gen1", "Generator 1", ENGINE_HINT),
      V("eng_gen2", "Generator 2", ENGINE_HINT),
    ],
    photos: ["Hour meters", "Engine plates", "Engine room"],
  },
  {
    id: "batteries",
    part: "Part A",
    title: "Battery details",
    remind: "One answer per battery bank.",
    items: [
      V("bat_house", "House bank", BATTERY_HINT),
      V("bat_startPort", "Start battery, port", BATTERY_HINT),
      V("bat_startStbd", "Start battery, starboard", BATTERY_HINT),
      V("bat_startCentre", "Start battery, centre", BATTERY_HINT),
      V("bat_gen1", "Generator 1 battery", BATTERY_HINT),
      V("bat_gen2", "Generator 2 battery", BATTERY_HINT),
      V("bat_thruster", "Bow thruster battery (if separate)", BATTERY_HINT),
    ],
    photos: ["Battery bank"],
  },
  {
    id: "service",
    part: "Part A2",
    title: "Engine service history",
    remind: "List every known service. A service with no receipt or invoice from a licensed marine mechanic or dealer will be treated by the buyer as unverified. Please send copies of your receipts to Brendon.",
    items: [
      V("svc_port", "Port engine (or single) services", SERVICE_HINT),
      V("svc_stbd", "Starboard engine services", SERVICE_HINT),
      V("svc_centre", "Centre engine services", SERVICE_HINT),
      V("svc_drives", "Stern drive services", SERVICE_HINT),
      V("svc_gen1", "Generator 1 services", SERVICE_HINT),
      V("svc_gen2", "Generator 2 services", SERVICE_HINT),
    ],
  },

  // ---------------- Part A: systems checklist ----------------
  {
    id: "nav",
    part: "Part A",
    title: "Navigation and electronics",
    remind: "For each unit tick the status, and add the make, model and quantity in the note if there is more than one.",
    opts: STATUS,
    items: [],
    checks: K("nav", [
      ["mfd", "Multifunction display (MFD)"],
      ["radar", "Radar"],
      ["plotter", "Chartplotter (if separate to MFD)"],
      ["sounder", "Depth sounder / fishfinder"],
      ["flir", "FLIR / thermal camera"],
      ["cctv", "Surveillance cameras (engine room, deck, CCTV)"],
      ["night", "Night vision camera"],
      ["vhfHelm", "VHF radio, helm"],
      ["vhfFly", "VHF radio, flybridge"],
      ["ais", "AIS transponder"],
      ["autopilot", "Autopilot"],
      ["compass", "Compass"],
      ["log", "Speed and log instrument"],
      ["wind", "Wind instruments"],
      ["satcom", "Satellite communications"],
      ["sattv", "Satellite TV system"],
      ["ipad", "iPad / tablet mount and bracket"],
    ]),
    photos: ["Helm displays powered on", "Electronics make and model plates"],
  },
  {
    id: "propulsion",
    part: "Part A",
    title: "Propulsion and manoeuvring",
    remind: "Mark N/A for anything not fitted. Please don’t leave a row blank, because a blank row can be read by a buyer as a working item.",
    opts: STATUS,
    items: [],
    checks: K("prop", [
      ["tabs", "Trim tabs / interceptors"],
      ["stabs", "Stabilisers", "Make, model and type."],
      ["bowThruster", "Bow thruster", "Brand."],
      ["sternThruster", "Stern thruster", "Brand."],
      ["joystick", "Joystick docking system", "Type."],
      ["wireless", "Wireless vessel controller", "Brand, e.g. Dock Master or Yacht Controller."],
      ["blower", "Engine room blower / ventilation fans"],
    ]),
  },
  {
    id: "fluids",
    part: "Part A",
    title: "Fuel and fluid systems",
    opts: STATUS,
    items: [],
    checks: K("fluid", [
      ["fuelTanks", "Fuel tanks", "Number and total capacity."],
      ["fuelSenders", "Fuel tank level senders / gauges"],
      ["fuelTransfer", "Fuel transfer pump"],
      ["waterTanks", "Fresh water tanks", "Number and total capacity."],
      ["waterPump", "Fresh water pump"],
      ["hotWater", "Hot water system", "Electric or heat exchanger."],
      ["watermaker", "Watermaker / desalinator"],
      ["grey", "Grey water holding tank"],
      ["black", "Black water holding tank", "Capacity."],
    ]),
  },
  {
    id: "acpower",
    part: "Part A",
    title: "Electrical: AC shore power and voltage",
    opts: STATUS,
    items: [],
    checks: K("ac", [
      ["v240", "Shore power system voltage, 240V AC (Australian standard)"],
      ["dual", "Dual voltage system, 240V and 110V AC both fitted"],
      ["inlet", "Shore power inlet, 240V", "Note the amperage: 32A or 50A."],
      ["cord", "Shore power cord and reel, 240V"],
      ["rcd", "Shore power RCD / safety switch"],
      ["acPanel", "AC distribution panel, all breakers labelled and working"],
    ]),
  },
  {
    id: "genset",
    part: "Part A",
    title: "Electrical: generator and inverter",
    opts: STATUS,
    items: [],
    checks: K("gen", [
      ["gen", "Generator", "Brand, model and hours."],
      ["genCooling", "Generator last cooling service", "Date."],
      ["genVolts", "Generator output voltage"],
      ["inverter", "Inverter output wattage, continuous"],
      ["charger", "Battery charger", "Brand."],
      ["combo", "Inverter / charger combined unit", "Model, e.g. Victron MultiPlus."],
    ]),
  },
  {
    id: "charging",
    part: "Part A",
    title: "Electrical: battery charging and management",
    opts: STATUS,
    items: [],
    checks: K("chg", [
      ["shoreCharger", "Battery charger, shore power", "Brand and amps."],
      ["altCharger", "Battery charger, alternator/s", "Output."],
      ["monitor", "Battery monitor / shunt display", "Brand, e.g. Victron BMV."],
      ["isolators", "Battery isolation switches, all operational"],
      ["dcPanel", "DC distribution panel / breaker board, all breakers labelled and working"],
      ["bms", "BMS (battery management system) fitted and operational", "Lithium banks only."],
    ]),
  },
  {
    id: "solar",
    part: "Part A",
    title: "Electrical: solar and renewables",
    opts: STATUS,
    items: [],
    checks: K("sol", [
      ["panels", "Solar panels", "Number fitted and total watts."],
      ["mppt", "Solar charge controller", "Brand, e.g. Victron MPPT."],
      ["windGen", "Wind generator", "Brand and output in watts."],
    ]),
  },
  {
    id: "lights",
    part: "Part A",
    title: "Electrical: lighting and accessories",
    opts: STATUS,
    items: [],
    checks: K("lit", [
      ["spot", "Spotlight / searchlight", "Remote control or manual."],
      ["underwater", "Underwater lights", "Number fitted and colour."],
      ["nav", "Navigation / running lights"],
      ["anchor", "Anchor light"],
      ["mast", "Mast and spreader lights"],
    ]),
  },
  {
    id: "safety",
    part: "Part A",
    title: "Safety equipment",
    remind: "Note expiry and service dates. Out-of-date flares, life jackets and fire equipment are common survey failures.",
    opts: STATUS,
    items: [],
    checks: K("saf", [
      ["mmsi", "DSC / MMSI registered", "Note the MMSI number."],
      ["pfds", "Life jackets / PFDs", "Quantity."],
      ["throwable", "Throwable flotation devices"],
      ["extSaloon", "Fire extinguisher, saloon"],
      ["extGalley", "Fire extinguisher, galley"],
      ["extEngine", "Fire extinguisher, engine room"],
      ["smoke", "Smoke detectors"],
      ["co", "CO detector"],
      ["mob", "Man overboard pole and light"],
      ["firstAid", "First aid kit"],
    ]),
  },
  {
    id: "bilge",
    part: "Part A",
    title: "Bilge pumps",
    opts: STATUS,
    items: [],
    checks: K("bil", [
      ["count", "Total number of bilge pumps aboard", "Say how many in the note."],
      ["bow", "Bilge pump, bow"],
      ["mid", "Bilge pump, midships"],
      ["stern", "Bilge pump, stern"],
      ["engine", "Bilge pump, engine room"],
      ["floats", "All automatic float switches"],
      ["manual", "Manual override switches"],
    ]),
  },
  {
    id: "helm",
    part: "Part A",
    title: "Helm and steering",
    opts: STATUS,
    items: [],
    checks: K("helm", [
      ["steerLower", "Helm steering, lower helm"],
      ["steerFly", "Helm steering, flybridge"],
      ["wipers", "Windscreen wipers, lower helm"],
      ["washers", "Windscreen washers"],
      ["throttleLower", "Throttle and shift controls, lower"],
      ["throttleFly", "Throttle and shift controls, flybridge"],
      ["sync", "Engine synchroniser"],
      ["sunroof", "Sunroof / electric sliding hatch"],
    ]),
  },
  {
    id: "deck",
    part: "Part A",
    title: "Deck and exterior",
    opts: STATUS,
    items: [],
    checks: K("deck", [
      ["windlass", "Anchor winch / windlass"],
      ["chain", "Anchor chain", "Size and length."],
      ["anchor", "Anchor"],
      ["counter", "Anchor chain counter"],
      ["washBow", "Anchor wash-down pump, bow"],
      ["washStern", "Deck wash-down pump, stern"],
      ["table", "Cockpit table"],
      ["fridge", "Cockpit fridge / drinks fridge"],
      ["bbq", "Cockpit BBQ / grill"],
      ["sink", "Cockpit sink and tap"],
      ["shower", "Cockpit shower, hot and cold"],
      ["ladder", "Swim ladder / folding steps"],
      ["platform", "Hydraulic platform / passerelle"],
      ["dinghy", "Dinghy / tender"],
      ["davits", "Davits or crane for tender"],
      ["outboard", "Outboard motor (tender)"],
    ]),
    photos: ["Cockpit", "Foredeck", "Anchor and windlass"],
  },
  {
    id: "flybridge",
    part: "Part A",
    title: "Flybridge",
    showIf: NOT_SAIL,
    remind: "Mark every row N/A if she has no flybridge.",
    opts: STATUS,
    items: [],
    checks: K("fly", [
      ["fridge", "Flybridge fridge"],
      ["sink", "Flybridge sink and tap"],
      ["speakers", "Flybridge speakers"],
    ]),
  },
  {
    id: "saloon",
    part: "Part A",
    title: "Saloon and interior",
    opts: STATUS,
    items: [],
    checks: K("sal", [
      ["curtains", "Electric curtains / blinds"],
      ["tvSaloon", "TV, saloon"],
      ["tvState", "TV, stateroom"],
      ["tvGuest", "TV, guest cabin"],
      ["sound", "Sound system / speakers"],
      ["amp", "Amplifier"],
      ["sub", "Subwoofer"],
      ["sat", "Satellite TV system / aerial"],
    ]),
    photos: ["Saloon", "Master cabin", "Guest cabins"],
  },
  {
    id: "galley",
    part: "Part A",
    title: "Galley",
    opts: STATUS,
    items: [],
    checks: K("gal", [
      ["stove", "Stove / cooktop", "Gas or electric."],
      ["oven", "Oven"],
      ["micro", "Microwave"],
      ["fridge", "Galley refrigerator"],
      ["freezer", "Galley freezer"],
      ["ice", "Ice maker", "Brand."],
      ["dish", "Dishwasher"],
      ["sink", "Galley sink, hot and cold"],
      ["fan", "Extractor fan / rangehood"],
      ["solenoid", "Gas solenoid shut-off valve"],
      ["lpg", "LPG bottles and regulator"],
    ]),
    photos: ["Galley"],
  },
  {
    id: "laundry",
    part: "Part A",
    title: "Laundry and cleaning",
    opts: STATUS,
    items: [],
    checks: K("lau", [
      ["washer", "Washing machine", "Brand and model."],
      ["dryer", "Clothes dryer", "Brand and model."],
      ["vac", "Ducted vacuum system", "Brand and model."],
    ]),
  },
  {
    id: "heads",
    part: "Part A",
    title: "Heads and toilets",
    remind: "Seized toilet seacocks are a common and costly survey finding. Please test them.",
    opts: STATUS,
    items: [],
    checks: K("head", [
      ["count", "Number of toilets aboard", "Say how many in the note."],
      ["working", "All toilets operational"],
      ["blackTank", "Black water holding tank", "Capacity and operational."],
      ["blackGauge", "Black water tank level gauge"],
      ["macerator", "Macerator pump"],
      ["yvalve", "Y-valve, overboard / holding tank diverter"],
      ["seacocks", "All toilet seacocks operational"],
    ]),
  },
  {
    id: "climate",
    part: "Part A",
    title: "Climate control",
    opts: STATUS,
    items: [],
    checks: K("clim", [["ac", "All air conditioners, heat and cool", "Number of units and zones."]]),
  },
  {
    id: "toys",
    part: "Part A",
    title: "Tender, toys and extras",
    opts: STATUS,
    items: [],
    checks: K("toy", [
      ["jetski", "Jet ski / PWC (if included)"],
      ["toys", "Water toys (tubes, skis, boards)"],
      ["fishing", "Fishing gear / outriggers"],
      ["snorkel", "Snorkelling equipment"],
      ["scuba", "Scuba / dive gear"],
      ["kayaks", "Kayaks or paddleboards"],
      ["rib", "Inflatable dinghy / RIB tender"],
    ]),
    photos: ["Tender", "Outboard and hour meter"],
  },
  {
    id: "mooring",
    part: "Part A",
    title: "Mooring and anchoring equipment",
    opts: STATUS,
    items: [],
    checks: K("moor", [
      ["lines", "Dock lines", "Quantity."],
      ["fenders", "Fenders", "Quantity."],
      ["hooks", "Boat hook(s)"],
      ["kedge", "Second anchor / kedge anchor"],
      ["snubber", "Snubber / chain hook"],
    ]),
  },
  {
    id: "history",
    part: "Part A",
    title: "Vessel history and maintenance",
    remind: "Give the date in the note for each one.",
    opts: YESNO,
    items: [],
    checks: K("hist", [
      ["polish", "Last hull polish", "Date."],
      ["antifoul", "Last antifoul application", "Date and product used."],
      ["liferaft", "Last life raft service", "Date."],
      ["epirb", "Last EPIRB battery replacement", "Date."],
    ]),
  },
  {
    id: "docs",
    part: "Part A",
    title: "Documentation and certificates",
    opts: SUPPLIED,
    items: [],
    checks: K("doc", [
      ["manEngines", "Manuals, engines"],
      ["manElec", "Manuals, electronics and navigation"],
      ["manApp", "Manuals, appliances and systems"],
      ["warranty", "Warranty documentation"],
      ["spares", "Spare parts kit"],
      ["tools", "Tool kit aboard"],
    ]),
  },
  {
    id: "rig",
    part: "Part A",
    title: "Sailing vessels: rig, sails and standing rigging",
    showIf: SAIL,
    remind: "Standing rigging age and receipts are checked closely on every sailing vessel purchase.",
    opts: STATUS,
    items: [],
    checks: [
      ...K("rig", [
        ["replaced", "Standing rigging last replaced", "Date."],
        ["furlHead", "Headsail furling system", "Brand."],
        ["furlMain", "Mainsail furling system", "In-boom or in-mast."],
        ["winches", "Winches, all operational"],
        ["selfTail", "Self-tailing winches"],
        ["electric", "Electric winches"],
        ["main", "Mainsail", "Brand, age and condition."],
        ["head", "Headsail / genoa", "Brand, age and condition."],
        ["spin", "Spinnaker / code zero", "Condition."],
        ["storm", "Storm jib / trysail"],
        ["keel", "Keel", "Type."],
        ["keelBolts", "Keel bolts", "Last inspected, date."],
        ["apDrive", "Autopilot below-deck drive unit"],
      ]),
      ...K("rig", [
        ["receipts", "Standing rigging: receipts / proof of replacement available"],
        ["sailInv", "Sail inventory complete", "Note any missing sails."],
      ], YESNO),
    ],
    photos: ["Mast base", "Mainsail", "Headsail", "Winches"],
  },

  // ---------------- Part B ----------------
  {
    id: "chattels",
    part: "Part B",
    title: "Chattels and inventory",
    remind: "Say what is included in the sale for each category. Items not listed should not be assumed to be included. Say “none” if nothing is included.",
    items: [
      V("cht_linen", "Linen (sheets, doonas, pillows, towels etc.)"),
      V("cht_crockery", "Crockery, cutlery and glassware"),
      V("cht_cookware", "Galley cookware and small appliances"),
      V("cht_bbq", "BBQ tools and outdoor / cockpit equipment"),
      V("cht_cleaning", "Cleaning and laundry equipment"),
      V("cht_tools", "Tools, spare parts and onboard workshop items"),
      V("cht_charts", "Charts, pilot books and reference materials"),
      V("cht_safety", "Safety items not already covered"),
      V("cht_fenders", "Fenders and dock lines (if not already covered)"),
      V("cht_toys", "Tenders, toys and water sports equipment (if not already covered)"),
      V("cht_other", "Other personal items included in the sale"),
      V("cht_excluded", "Items specifically EXCLUDED from the sale", "List anything that will be removed before handover."),
    ],
    photos: ["Items included", "Items for sale"],
  },

  // ---------------- marketing + disclosure ----------------
  {
    id: "upgrades",
    title: "Upgrades and highlights",
    marketing: true,
    remind: "This part is for the listing. Brendon will edit it before anything is published.",
    items: [
      V("recentWork", "What major work, refits or upgrades have been done recently, with approximate dates?"),
      V("highlights", "What are the standout features of this vessel?"),
    ],
    photos: ["Recent upgrades", "Standout features"],
  },
  {
    id: "story",
    title: "The story of the vessel",
    marketing: true,
    items: [
      V("trips", "Where has she been? Tell us about your favourite trips and anchorages."),
      V("moments", "Any memorable moments, such as a dolphin sighting, a family holiday or a celebration?"),
      V("whyChose", "Why did you choose her, and why are you selling?"),
      V("miss", "What will you miss most?"),
      V("suits", "Who do you think she would suit best?"),
    ],
    photos: ["Favourite trip photo", "Sunset or anchorage"],
  },
  {
    id: "issues",
    title: "Anything else to disclose",
    remind: "This is the most important question. Anything a surveyor might find should be recorded here.",
    items: [
      V("knownFaults", "List every known fault, defect or item needing repair, however small."),
      V("pastRepairs", "List major repairs, groundings, insurance claims or incidents."),
      V("leftOut", "Is there anything a surveyor might find that you have not already mentioned?"),
    ],
    photos: ["Faults and defects"],
  },
];

export function matches(rule: ShowIf | undefined, answers: Record<string, unknown>): boolean {
  if (!rule) return true;
  const v = answers[rule.id];
  const s = typeof v === "string" ? v : undefined;
  if (rule.in) return s !== undefined && rule.in.includes(s);
  if (rule.notIn) return s === undefined || !rule.notIn.includes(s);
  return true;
}
export const itemVisible = (item: Item, answers: Record<string, unknown>) => matches(item.showIf, answers);
export const sectionVisible = (sec: Section, answers: Record<string, unknown>) => matches(sec.showIf, answers);

export const optsOf = (sec: Section, c: Check): readonly string[] => c.opts ?? sec.opts ?? STATUS;

/** Flat list of steps the seller walks through. */
export type Step =
  | { kind: "intro" }
  | { kind: "item"; sectionId: string; item: Item; first: boolean }
  | { kind: "checklist"; sectionId: string }
  | { kind: "photos"; sectionId: string }
  | { kind: "declaration" };

export function buildSteps(answers: Record<string, unknown>): Step[] {
  const steps: Step[] = [{ kind: "intro" }];
  for (const sec of SECTIONS) {
    if (!sectionVisible(sec, answers)) continue;
    let first = true;
    for (const item of sec.items) {
      if (!itemVisible(item, answers)) continue;
      steps.push({ kind: "item", sectionId: sec.id, item, first });
      first = false;
    }
    if (sec.checks?.length) steps.push({ kind: "checklist", sectionId: sec.id });
    if (sec.photos) steps.push({ kind: "photos", sectionId: sec.id });
  }
  steps.push({ kind: "declaration" });
  return steps;
}

const GROUPS = [
  {
    label: "Tecnici",
    keys: ["Corners", "Crossing", "Dribbling", "Finishing", "First Touch", "Freekicks", "Heading", "Longshots", "Longthrows", "Marking", "Passing", "Penalty Taking", "Tackling", "Technique"],
  },
  {
    label: "Mentali",
    keys: ["Aggression", "Anticipation", "Bravery", "Composure", "Decisions", "Concentration", "Determination", "Flair", "Leadership", "Positioning", "Off The Ball", "Teamwork", "Vision", "Workrate"],
  },
  {
    label: "Fisici",
    keys: ["Acceleration", "Agility", "Balance (E)", "Jumping", "Natural Fitness", "Pace", "Stamina", "Strength"],
  },
  {
    label: "Portiere",
    keys: ["Handling", "Aerial Reach", "Command of Area", "Communication", "Kicking", "Throwing", "One on Ones", "Reflexes", "Rushing Out", "Punching", "Eccentricity"],
  },
];

const LABELS = {
  "Balance (E)": "Equilibrio",
  "Off The Ball": "Senza palla",
  Workrate: "Abbattimento",
  Freekicks: "Punizioni",
  Longthrows: "Rimesse",
  "Penalty Taking": "Rigori",
};

export function skillLabel(key) {
  return LABELS[key] || key;
}

export function skillGroups(skills, role) {
  if (!skills || !Object.keys(skills).length) return [];
  return GROUPS.filter((group) => (group.label === "Portiere" ? role === "P" : true))
    .filter((group) => (role === "P" ? group.label !== "Tecnici" : group.label !== "Portiere"))
    .map((group) => ({
      label: group.label,
      items: group.keys
        .filter((key) => typeof skills[key] === "number")
        .map((key) => ({ key, label: skillLabel(key), value: skills[key] })),
    }))
    .filter((group) => group.items.length > 0);
}

export function skillTone(value) {
  if (value >= 15) return "bg-emerald-400";
  if (value >= 11) return "bg-sky-400";
  if (value >= 7) return "bg-amber-400";
  return "bg-rose-400/80";
}
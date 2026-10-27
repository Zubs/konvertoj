const colourNames = new Set(
  [
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue",
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson",
    "cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen",
    "darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet",
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro",
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred",
    "indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan",
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey",
    "lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid",
    "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin",
    "navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen",
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple",
    "red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver",
    "skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle",
    "tomato turquoise violet wheat white whitesmoke yellow yellowgreen",
  ]
    .join(" ")
    .split(" "),
);

const hexColour = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const rgbColour =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;

export function isColour(value: string): boolean {
  if (hexColour.test(value) || colourNames.has(value.toLowerCase())) {
    return true;
  }
  const channels = rgbColour.exec(value);
  return (
    channels !== null &&
    channels.slice(1, 4).every((channel) => Number(channel) <= 255)
  );
}

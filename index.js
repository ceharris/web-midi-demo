var midiAccess;
var selectedInput;
var selectedOutput;

const NOTE_OFF = 0;
const NOTE_ON = 1;
const NOTE_PRESSURE = 2;
const CONTROL_CHANGE = 3;
const PROGRAM_CHANGE = 4;
const CHANNEL_PRESSURE = 5;
const PITCH_BEND = 6;
const SYSTEM_MESSAGE = 7;

const NOTE_NAMES = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

const CONTROLLERS = {
  0: { name: "Bank Select" },
  1: { name: "Modulation Wheel" },
  2: { name: "Breath Controller" },
  4: { name: "Foot Controller" },
  5: { name: "Portamento Time" },
  6: { name: "Data Entry" },
  7: { name: "Channel Volume" },
  8: { name: "Balance" },
  10: { name: "Pan" },
  11: { name: "Expression Controller" },
  12: { name: "Effect Control 1" },
  13: { name: "Effect Control 2" },
  16: { name: "General Purpose Controller 1" },
  17: { name: "General Purpose Controller 2" },
  18: { name: "General Purpose Controller 3" },
  19: { name: "General Purpose Controller 4" },
  64: { name: "Sustain", values: [ "Off", "On" ] },
  65: { name: "Portamento", values: [ "Off", "On" ] },
  66: { name: "Sostenuto", values: [ "Off", "On" ] },
  67: { name: "Soft", values: [ "Off", "On" ] },
  68: { name: "Legato", values: [ "Off", "On" ] },
  120: { name: "All Sound Off" },
  121: { name: "Reset All Controllers" },
  122: { name: "Local Control", values: [ "Off", "On" ] },
  123: { name: "All Notes Off" },
  124: { name: "Omni Mode Off" },
  125: { name: "Omni Mode On" },
  126: { name: "Mono Mode On" },
  127: { name: "Poly Mode On" }
};

const SYSTEM_MESSAGES = [ 
    "System Exclusive",
    "MIDI Time Code",
    "Song Position Pointer",
    "Song Select",
    "Undefined",
    "Undefined",
    "Tune Request",
    "EOX",
    "Timing Clock",
    "Undefined",
    "Sequence Start",
    "Sequence Resume",
    "Sequence Stop",
    "Undefined",
    "Active Sensing",
    "Reset"
];

$(document).ready(function() { 
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: true })
        .then(onMidiSuccess)
        .catch(onMidiFailure);
    $("#port-select-input").on("change", onChangeInput);
    $("#port-select-output").on("change", onChangeOutput);
  }
  else {
    alert("No MIDI support in this browser");
  }
});

function onMidiSuccess(access) {
  midiAccess = access;
  midiAccess.onstatechange = onMidiStateChange;
  fillPortSelection("#port-select-input", midiAccess.inputs.values());
  fillPortSelection("#port-select-output", midiAccess.outputs.values());
}

function onMidiFailure(err) {
  alert("access to MIDI not allowed: " + err);
}

function onMidiStateChange(event) {
  console.log("MIDI state change ", event);
  var port = event.port;
  var selector = "#port-select-" + port.type;
  switch (port.state) {
    case "connected":
      addPortOption(selector, port);
      break;
    case "disconnected":
      removePortOption(selector, port);
      break;
  }
}

function onMidiMessage(event) {
  var message = eventToMessage(event);
  console.log("received MIDI message", message);
  switch (message.type) {
    case NOTE_OFF:
    case NOTE_ON:
      onNoteMessage(message);
      break;
    case CONTROL_CHANGE:
      onControlChangeMessage(message);
      break;
    case PITCH_BEND:
      onPitchBendMessage(message);
      break;
    case SYSTEM_MESSAGE:
      onSystemMessage(message);
      break;
    default:
      break;
  }
}

function onNoteMessage(message) {
  const off = message.type == NOTE_OFF || message.type == NOTE_ON && message.data[1] == 0;
  const note = NOTE_NAMES[message.data[0] % 12];
  const octave = Math.floor(message.data[0] / 12) - 2;
  const velocity = message.data[1];
  addTableRow(message.timestamp, 
      "Note " + (off ? "Off" : "On"),
      note + octave + " " + velocity,
      message.channel);
}

function onControlChangeMessage(message) {
  const controller = message.data[0];
  const coarse = controller < 0x20;
  const fine = controller >= 0x20 && controller < 0x40;
  const index = fine ? controller - 0x20 : controller;
  
  let name = CONTROLLERS[index] === undefined ? 
      "Undefined" : CONTROLLERS[index].name;
  if (coarse) {
    name += " (coarse)";
  }
  else if (fine) {
    name += " (fine)";
  }

  const degree = message.data[1];
  let value = degree;
  if (CONTROLLERS[index].values !== undefined) {
    const ordinal = Math.floor(degree / CONTROLLERS[index].values.length);
    value = CONTROLLERS[index].values[ordinal];
  }
  addTableRow(message.timestamp, "Control Change", 
      name + " " + value, message.channel);
}

function onPitchBendMessage(message) {
  const degree = ((message.data[1]<<7) | message.data[0]) - 0x2000;
  addTableRow(message.timestamp, "Pitch Bend", degree, message.channel);
}

function onSystemMessage(message) {
  const messageType = SYSTEM_COMMON_MESSAGES[message.status & 0xf];
  addTableRow(message.timestamp, messageType, undefined, undefined)
}

function eventToMessage(event) {
  var message = {};
  message.timestamp = event.timeStamp;
  message.status = event.data[0];
  message.type = (message.status >> 4) & 0x7
  if (message.type < SYSTEM_MESSAGE) {
    message.channel = (event.data[0] & 0xF) + 1;
  }
  message.data = event.data.slice(1);
  return message;  
}

function addTableRow(timestamp, message, data, channel) {
  $tr = $("<tr>")
          .append($("<td>").attr("class", "timestamp").text(timestamp.toFixed(3)))
          .append($("<td>").attr("class", "message").text(message))
          .append($("<td>").attr("class", "channel").text(channel))
          .append($("<td>").attr("class", "data").text(data));

  $("#message-table").find("tbody").append($tr);

  $tr.get(0).scrollIntoView();
}

function onChangeInput(event) {
  var input = selectPort(this.value, midiAccess.inputs.values());
  if (input != selectedInput) {
    console.log("input selected: ", input ? input.name : "(none)");
    setInputHandler(selectedInput, null);
    selectedInput = input;
    setInputHandler(selectedInput, onMidiMessage);
  }
}

function setInputHandler(port, handler) {
  if (!port) return;
  port.onmidimessage = handler;
}

function onChangeOutput(event) {
  var output = selectPort(this.value, midiAccess.outputs.values());
  if (output != selectedOutput) {
    console.log("output selected: ", output ? output.name : "(none)");
    selectedOutput = output;
  }
}

function selectPort(portId, ports) {
  if (portId == "no-selection") return null;
  for (let port of ports) {
    if (port.id === portId) {
      return port;
    }
  }
}

function fillPortSelection(selector, ports) {
  for (let port of ports) {
    addPortOption(selector, port);
  }
}

function addPortOption(selector, port) {
  if ($(selector + " option[value=" + port.id + "]").length) return;
  var opt = new Option(port.name, port.id);
  $(selector).append(opt);
}

function removePortOption(selector, port) {
  $(selector + " option[value=" + port.id + "]").remove();
}
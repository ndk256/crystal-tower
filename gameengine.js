//Game engine to run Zork and similar text adventures.
//Basic structures provided by Jim Skon's Zork program.

var world;
var points=0;

// Actions to get things started
$(document).ready(function () {

    $('#command-btn').click(command);

    var input = document.getElementById("command");
    // Respond to enter key
    input.addEventListener("keyup", function(event) {
      // Number 13 is the "Enter" key on the keyboard
      if (event.keyCode === 13) {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the button element with a click
        command();
      }
    });
});

// Get things set up
getWorld();

// Print to terminal, and clear the input
function printLine(text) {
  $('#term').append(text+"<br />");
  var objDiv=$('#term')[0];
  objDiv.scrollTop = objDiv.scrollHeight;
}

//Input and process command
// Called from submit button or enter
function command() {
  com=$('#command').val();
  printLine("<span style='color:blue'>>>> "+com+"</span>");
  $('#command').val('');
  processCommand(world,com.toLowerCase());
}

// Read in XML
function getWorld() {
  $.ajax({
    url: "glasstower.xml", // name of file you want to parse
    dataType: "xml",
    success: setupWorld,
    error: function(){alert("Error: Something went wrong reading XML");}
  });
}

// Take XML and set up world
function setupWorld(xml) {
  var map = $(xml).find("map");
  //console.log((new XMLSerializer()).serializeToString(xml));
  world = new World(map);
  world.objects[world.location].enter();
}

//function to remove item, if present, from array
function remove(array, item)
{
  let index = array.indexOf(item);
  if(index>-1){
    array.splice(index,1);
  }
  return array;
}

//function to add (a positive or negative value) to points
function add_points(pts){
  points += parseInt(pts);
  $('#points').text(points);
}

//function to do some visual effects (for immersion i guess)
//not my best work but i wanted to try it out
function changeScreen(code)
{
  //improvement: is there a way to animate this? I couldn't get it to work

  if(code==1)
  {
    $('.jumbotron').css('background-color', 'rgba(255,255,0,.1');
    $('#favicon').attr('href', 'favicon.ico');
  }

  else if(code==2)
  {
    $('.jumbotron').css('background-color', 'rgba(5,5,0,.5');
    $('#favicon').attr('href', 'favicon-2.ico');
  }

  else console.log("error: unknown visual code.");
}

//function to terminate play
// and display point total
function endGame()
{
  $('#term').css('font-size', "1.5em");
  $('#term').css('color', "purple");
  $('#term').css('background-color', "black"); //maybe?
  $('#term').html("You've reached the end of this run.<br/><br/><br/>Your point total is: " + points + ".<br/><br/>You can reload the page to play again.");
  //improvement: any better reset method?

  $('#term').removeAttr('id');
  $('#command').hide();
  $('#command-btn').hide();
}

// World Class.  Contains all top-level objects
// like rooms, items, creatures, triggers, etc
class World {
  constructor(map) {
    console.log("World");
    var self=this;
    self.location="Entrance";
    self.objects=[];//[inventory.name]=inventory;
    self.rooms=[];
    self.items=[];
    self.containers=[];
    self.creatures=[];
    self.triggers=[];

    // Create lists of names for each type of object in world
    // and an associative list holding objects' data
    map.children().each(function() {
      var tag=this.nodeName;
      let thing;
      switch(tag){
        case "room":
          thing = new Room(this);
          // add room's name to list of rooms
          self.rooms.push(thing['name']);
          break;
        case "item":
          thing = new Item(this);
          // add item's name to list of items
          self.items.push(thing['name']);
          break;
        case "container":
          thing = new Container(this);
          // add container's name to list of containers
          self.containers.push(thing['name']);
          break;
        case "creature":
          thing = new Creature(this);
          // add creature's name to list of creatures
          self.creatures.push(thing['name']);
          break;
      }
      self.objects[thing['name']] = thing;
      //add object to associative list of objects
    });//end forEach

    if(self.objects["inventory"]==undefined)
    {
      console.log("error:inventory not defined");
      self.objects["inventory"]=new Container("");//will this work??
    }

    // build associative list of triggers from throughout the document
    map.find('trigger').each(function(){
      let trigger = new Trigger(this);
      if(self.triggers[trigger['command']]==undefined)
        self.triggers[trigger['command']] = [trigger];
      else self.triggers[trigger['command']].push(trigger);
    });
  }//end ctor

  // function to check if any triggers are activated
  // by the given command and the world state
  check_triggers(command){
    let active = [];
    let to_execute = [];
    var self=this;

    //consider triggers matching the command
    // and triggers without an associated command
    if(this.triggers[""]!=undefined)
    {
      active = active.concat(this.triggers[""]);
    }
    if(this.triggers[command]!=undefined)
    {
      active = active.concat(this.triggers[command]);
    }

    active.forEach(function(t) //for each trigger
    {
      let activated = true;

      //check trigger's Condition elements to ensure all are fulfilled
      t.conditions.forEach(function(c){
        if(!c.fulfilled(self))
          activated = false;
        });

      if(activated)
      {
        console.log(t.actions);//debug

        if(t.blocking)
        {
          to_execute.push(new Action("skip"));
        }

        //carry out print
        if(t.print.length>0)
        {
          t.print.forEach(function(line)
          {printLine(line);}
          );
          to_execute.push(new Action("print")); //to signal there was a print trigger
        }

        //add the trigger's actions to the "to-do list"
        // which will be passed up
        to_execute = to_execute.concat(t.actions);

        //if the activated trigger is not permanent, remove it
        if(!t.permanent){
          if(self.triggers[""]!=undefined && self.triggers[""].length>1)
          {
            self.triggers[""] = remove(self.triggers[""], t);
          }
          else
          if(self.triggers[""]==t) self.triggers[""]=[];

          if(self.triggers[command]!=undefined && self.triggers[command].length>1)
          {
            self.triggers[command] = remove(self.triggers[command], t);
          }
          else
          if(self.triggers[command]==t) self.triggers[command]=[];
        }//end if(!t.permanent)

        }//end if(activated)

      });//end forEach(t)

    return to_execute; //pass back the actions to execute
  }//end check_triggers

  print_inventory(){
    this.objects["inventory"].print_contents();
  }//end print_inventory

  transfer_item(item, from, to){
   if(this.objects[from]!=undefined&&this.objects[to]!=undefined){
    if(this.objects[item]!=undefined){
      if(this.objects[from].contents.includes(item))
      {
        this.objects[to].contents.push(item);
        remove(this.objects[from].contents, item);
      }
      else
        console.log(from +" does not have "+item);
    }
    else
      console.log("error: item does not exist.");
  }
  else
    console.log("error: invalid target/source for item transfer.");
 }//end transfer_item
}//end World

// Action class. A data structure that stores the
// three semantic pieces of actions.
class Action{
  constructor(string)
  {
    //split the words of the action into an array
    let temp = string.split(" ");

    //the first word is the action (e.g., "update" or "exit")
    this.type = temp[0];

    //the second word, if present, is the target of the action
    if(temp.length>1)
      this.subject = temp[1];

    //the third word, if present, is "to"; ignore it
    //the fourth word, if present, is the destination of the action
    if(temp.length>3)
      this.context = temp[3];
  }

} //end Action

// Condition class. This contains a set of requirements
// about the status of a world or its objects
class Condition{
  constructor(node)
  {
    //currently supported conditions pertain to:
    //objects having, or not having, specific statuses or owners
    this.object=$(node).find('>object').text();
      if(this.object==undefined) this.object='';
    this.object_status=$(node).find('>status').text();
      if(this.object_status==undefined) this.object_status='';
    this.owner = $(node).find('>owner').text();
      if(this.owner==undefined) this.owner='';
    if($(node).find('>has').text() =="no")
        this.has=false;
      else this.has=true;

    //record what object must be present for condition to be relevant
    this.parent_object = $(node).parent().parent().find('>name').text();
  }//end ctor

  //function to check if the condition is
  //satisfied by the state of world
  fulfilled(world){
    let yes=true;

    //check if relevant object is present
    if(world.objects[this.parent_object]==undefined)
      yes=false; //it doesn't exist in world

    else if(world.rooms.includes(this.parent_object))
    {
      if(world.location!=this.parent_object)
        yes=false; //player not in the relevant room
    }
    else if(!world.objects[world.location].contents.includes(this.parent_object))
    {
      yes=false; //object not in the room
    }

      //check ownership
    if(this.owner!=""){ //ownership condition present
        if(this.has)
          {
            if(world.objects == undefined || !world.objects[this.owner].contents.includes(this.object))
              yes=false;
          }
        else
          {
            if(world.objects[this.owner].contents != undefined && world.objects[this.owner].contents.includes(this.object))
            {
              yes=false;
            }
          }
      }

    //check status
    if(this.object_status!="" && world.objects[this.object].status != this.object_status)
        {
          yes=false;
        }

    return yes;
  }//end fulfilled()
}//end Condition

// Trigger class. Stores a set of conditions and
// actions to be executed and/or text to be printed upon their fulfillment
class Trigger{
    constructor(node)
    {
      var self=this;
       self.print = [];
       self.actions = [];
       self.conditions=[];
      this.permanent=false;
      this.blocking=false;
      this.command="";

      $(node).children().each(function() {
        let tag=this.nodeName;
        switch(tag)
        {
          case "condition":
            let condition = new Condition(this);
            self.conditions.push(condition);
            break;
          case "type":
            if($(this).text()=="permanent")
              self.permanent=true;
            break;
          case "command": //area of improvement: multiple command options
            self.command=$(this).text();
            break;
          case "action":
            let action = new Action($(this).text());
            self.actions.push(action);
            break;
          case "print":
            self.print.push($(this).text());
            break;
          case "block":
            if($(this).text()=="yes") self.blocking=true;
            break;
        }//end switch
      });//end forEach()

      /*
      if(self.conditions.length<1)
      {
      //make one with the parent object
      }
      */
    }//end ctor
}//end Trigger

//generic Object class
// Room, Item, Container, Creature, etc. will inherit from this
class Object{
  constructor(node)
  {
    //an object will, at minimum, have a name
    //and should be able to have a description and status
    this.name=$(node).find('>name').text();

    var self=this;
    self.descriptions=[];
    $(node).children().each(function() {
      if(this.nodeName == 'description')
      self.descriptions.push($(this).text());
    });
    this.description=this.descriptions[0];
    if(this.description==undefined)
        this.description="The " + this.name + " is nondescript.";

    this.status=$(node).find('>status').text();
    if(this.status==undefined)
        this.status='';
  }//end ctor

  //mutator function for status
  update_status(new_status)
  {
    this.status = new_status;
  }

  //mutator function for description
  swap_description(nth)
  {
    if(this.descriptions[nth]!=undefined)
      this.description = this.descriptions[nth];
  }

  //print description
  describe()
  {
    printLine(this.description);
  }
}//end Object

// Room class.
// Contains all room information
// and methods for using a room
class Room extends Object{
  constructor(node)
  {
    super(node);
    var self=this;
    self.contents=[];
    self.borders=[];
    $(node).children().each(function(index) {
      let tag=this.nodeName;
      if (tag=="item" || tag=="creature" || tag=="container") {
        self.contents.push($(this).text());
      } else if (tag=="border") {
          let border = new Border(this);
          self.borders.push(border);
      }
    });
  }//end ctor

  // prints the contents (items, containers, creatures, etc.)
  // that are in this room
  print_contents()
  {
    //default text if no contents
    let result="<br/>There is nothing in this room.<br/>";

    if (this.contents.length > 0) {
      result="In the room, you see:<br/>";
      this.contents.forEach(function(thing) {
        result+=thing+"<br/>";
        if(world.objects[thing].contents!=undefined && world.objects[thing].opened)
        {
          world.objects[thing].contents.forEach(function(item)
          {
            result += item+" (in " +thing+")<br/>";
          }
        );//end forEach() on thing.contents
        }
      }); //end forEach() on this.contents
    }
    printLine(result);
  }//end print_contents

  // describe the room upon entry
  enter() {
    this.describe();
    //if (this.action == "exit") {
    //  printLine("The game is over!");
    //}
  }

  // list the borders of the room
  look_around() {
    this.borders.forEach(function(b) {
      printLine("If you go "+b.direction+", you will go to the "+b.name+".");
    });
  };

  check_border(direction) {
  // Look around the borders.  if the command given matches
  // a border, return that name of that room
    var to="";
    this.borders.forEach(function(b) {
      if (b.direction==direction) {
        console.log("goto:",b.name);
         to = b.name;
      }
    });
    return to;
  };

}//end Room

// Border Class
// Used to manage conections between rooms
class Border {
    constructor(node) {
      this.name=$(node).find('>name').text();
      this.direction=$(node).find('>direction').text();
    }
}

// Item class.
class Item extends Object
{
  constructor(node)
  {
    super(node);
    this.writing=$(node).find('>writing').text();
    if(this.writing==undefined || this.writing =="") //idk
      this.writing="There's nothing on the "+this.name+".";

    if($(node).find('>turnon')!=undefined)
      {
        this.on_able=true;
        this.on_print=$(node).find('>turnon').find('>print').text();
        this.on_status=$(node).find('>turnon').find('>status').text();
      }
    else this.on_able=false;
  }//end ctor

  turn_on()
  {
    if(this.status==this.on_status)
    {
      printLine('The ' + this.name + ' is already active.');
    }
    else{
      printLine(this.on_print);
      this.update_status(this.on_status);
    }
  }
}//end Item

//Container class. Has a list of its (Item) contents by their names
// and a means of being opened.
class Container extends Object{
  constructor(node)
  {
    super(node);
    var self=this;
    this.opened=false;
    self.contents=[];
    $(node).children().each(function(index) {
      let tag=this.nodeName;
      if (tag=="item" || tag=="container")
        self.contents.push($(this).text());
      });
  }//end ctor

//action upon being opened
  open()
  {
    this.opened=true;
    this.print_contents();
  }

//function to print names of what is in the container
  print_contents()
  {
    var self=this; let result=""
    if (this.contents.length > 0) {
      result+="<br/>" + this.name + " contains:<br/>";
      this.contents.forEach(function(thing) {
        result+=thing+"<br/>";
      });
    }
    else {
      result+="<br/>" + self.name + " is empty.";
    }
  printLine(result);
  }//end print_contents
}//end Container

//Creature class.
class Creature extends Object{
  constructor(node)
  {
    super(node);
    this.health=$(node).find('>hp').text();
    if(this.health==undefined)
      this.health=1;

    var self=this;
    self.weaknesses=[];
    $(node).children().each(function() {
      if (this.nodeName=="vulnerability")
        self.weaknesses.push($(this).text());
      });

    this.points=parseInt($(node).find('>points').text());
    if(this.points==NaN)
      this.points=0;

  }//end ctor

  attacked(weapon){
    if(this.weaknesses.includes(weapon))
    {
      this.health--;
      printLine("A solid hit!");
    }
    if(this.health<1)
    {
      add_points(this.points);
      return "dead";
    }
    else
    {
      if(this.health==1)
        printLine("The " + this.name + " seems close to defeat.");
      return "alive";
    }
  }//end attacked()
}//end creature

function execute_action(a, world)
{
  switch(a.type)
  {
  case "visual":
    console.log("VISUAL");
    changeScreen(a.subject);
    break;
  case "skip":
    break; //handled elsewhere
  case "print":
    break; //because printing was already handled
  case "redescribe":
    world.objects[a.subject].swap_description(a.context);
    break;
  case "update":
    console.log("update");
    if(world.objects[a.subject]!=undefined) //find the subject
    {
      world.objects[a.subject].update_status(a.context);
    }
    else console.log("update failed:"+a.subject+" does not exist");
    break;
  case "delete": //remove an object from its current place
    console.log("delete");
    for(var key in world.objects){
        if(world.objects[key].contents!=undefined && world.objects[key].contents.includes(a.subject))
          {
            remove(world.objects[key].contents, a.subject);
          }
      }
    break;
  case "add": //add an object to somewhere
    console.log("add");
    if(world.objects[a.subject]!=undefined && world.objects[a.context]!=undefined)
    //check that the object and its target location exist
    {
      world.objects[a.context].contents.push(a.subject);
      //note: this could allow, say, adding an item to the "contents" of another item
    }
    else console.log("add failed: object or location is not defined.");
    break;
  case "points": //add/subtract points
    add_points(a.subject); //hope this works
    break;
  case "exit": //game over
    console.log("exit");
    endGame();
    break;
  }//end switch
}//end execute_action

// routine to take an entered command and process its action
function processCommand(world,command) {
  console.log(command);

  //first check if the command or current world state matches a trigger
  let actions = world.check_triggers(command);
  console.log(actions);

let skip=false;

  if(actions.length>0) //if trigger(s) activated
  {
    actions.forEach(function(a){
      if(a.type=="skip") skip=true;
      execute_action(a, world);
    });
  }

  if(!skip){
    //no blocking triggers, so treat it as a normal command
    c=command.split(" ");
    nextRoom="";

    switch(c[0]){
      case "look":
        if(c.length>1 && c[1]=="around")
        {
          c.splice(1,1); //shift over
        }
        if(c.length==1){
          world.objects[world.location].print_contents();
          world.objects[world.location].look_around();
        }
        else
        {
          if(c[1] == "at" && c.length>2)
            c.splice(1,1); //shift over
          if(world.objects[world.location].contents.includes(c[1]))
          {
            world.objects[c[1]].describe();
          }
          else printLine("You look around, but don't see that in the room.");
        }
        break;
      case "go":
        if (c.length<2) {
          world.objects[world.location].look_around();
          printLine("Where will you go?");
        }
        else {
          nextRoom=world.objects[world.location].check_border(c[1]);
          console.log("L:",nextRoom);
          if (nextRoom!="" && nextRoom != world.location) {
            world.location=nextRoom;
            world.objects[world.location].enter();
          }
          else {
            printLine("Can't go that way.");
            world.objects[world.location].look_around();
          }
        }
        break;
      case "inventory": //means the same as "i"
      case "i":
        world.print_inventory();
        break;
      case "take":
        if(world.items.includes(c[1]))
        {
          if(world.objects[world.location].contents.includes(c[1]))
          {
            world.transfer_item(c[1], world.location, "inventory");
            printLine("You pick up the " + c[1] + ".");
          }
          else world.objects[world.location].contents.forEach(function(cont)
        {
          if(world.containers.includes(cont))
          {
            if(world.objects[cont].contents!=undefined && world.objects[cont].contents.includes(c[1]))
            {
              world.transfer_item(c[1], cont, "inventory");
              printLine("You take the " + c[1] + " from the " +cont+ ".");
            }
          }
          });
        }
        else printLine("Cannot take " + c[1] +".");
        break;
      case "open":
        if(world.containers.includes(c[1])){
          if(world.objects[c[1]].status!="locked"){
            printLine("You open the " + c[1] +"."); //todo: put in func?
            world.objects[c[1]].open();
          }
        else{ //container is locked
          printLine("You try to open the " + c[1] + ", but it's shut tight.");
          break;
          }
        }
        else //c[1] not a container
          printLine("You can't open that.");
        break;
      case "drop":
        if(world.objects["inventory"].contents.includes(c[1]))
        {
          world.transfer_item(c[1], "inventory", world.location);
          printLine("You drop the " + c[1] + ".");
        }
        else
          printLine("You don't have any of those to drop.");
        break;
      case "put":
        if(c[2] == "in"){
          if(world.objects["inventory"].contents.includes(c[1])) //if you have the item
          {
            if(world.containers.includes(c[3]))
            {
              if(world.objects[world.location].contents.includes(c[3]))
              {
                if(world.objects[c[3]].opened)
                {
                  world.transfer_item(c[1], "inventory", c[3]);
                  printLine("You put the " + c[1] + " in the " + c[3] + ".");
                }
                else //container is closed
                  printLine("The " + c[3] + " is not open.");
              }
              else //container isn't in room contents
                printLine("There's no " + c[3] + " to put anything in.");
            }
            else //c[3] isn't a container
              printLine("You can't put anything in the " + c[3] + ".");
          }
          else //inventory doesn't have c[1]
            printLine("You don't have " + c[1] + ".");
      }
      else printLine("Cannot do that.");
        break;
      case "read":
        if(c.length>1)
        {
          //only things in the room itself and the inventory are readable
        if(world.objects[world.location].contents.includes(c[1]) || world.objects["inventory"].contents.includes(c[1]))
        {
          if(world.objects[c[1]]!=undefined && world.objects[c[1]].writing!=undefined)
          {
            printLine(world.objects[c[1]].writing);
          }
          else
            printLine("There's nothing to read.");
        }
        else
          printLine("There is no " + c[1] + " where you can read.");
        }
        else
          printLine("Read what?");
        break;
      case "activate":
          if(world.objects["inventory"].contents.includes(c[1]))
          {
            if(world.objects[c[1]].on_able){
              world.objects[c[1]].turn_on();
            }
            else
              printLine("The " + c[1] + " seems unaffected.");
          }
          else
            printLine("You don't have that.");
        break;
      case "attack":
        if(c.length>1 && world.objects[c[1]]!=undefined)
        {
          if(c.length>3 && c[2]=="with" && world.objects["inventory"].contents.length>0)
          {
            if(world.objects["inventory"].contents.includes(c[3]))
            {
              printLine("You swing at the " + c[1] + " with the " + c[3] +".");
              if(world.creatures.includes(c[1]))
              {
                if(world.objects[c[1]].attacked(c[3])=="dead")
                {
                  remove(world.objects[world.location].contents, c[1]);
                  printLine("You've defeated the " + c[1] +".");
                }
              }
            }
            else
              printLine("You don't have " + c[3] +".");
          }
          else
            if(c.length<3)
              printLine("You flail wildly at the " + c[1] +".");
          else
            printLine("Need to specify weapon.")
        }
        else
          printLine("Attack needs an existing target.")
        break;
        default:
          printLine("Not a command.");
    }//end switch
  }//end if(!skip)
}//end processCommand

const mongoose = require('mongoose')

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const UserSchema = new Schema({
  _id : ObjectId,
  mail : {type : String, required : true , unique : true ,
match : /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/},
  name : {type : String, required : true} , 
  surname : {type : String, required : true} , 
  password : {type : String, required : true} , 
  age : { type: Number, min: 18, max: 65 },
  sexe  : {type : String, required : true} , 
  createdAt : { type: Date, default: Date.now },
  userPdp : {type : String ,default : ""} , 
  pubsPhotos : {type : [String], default : []}, 
  pubs: {type : [ObjectId] , default : []},
  favorites : {type : [ObjectId] , default : []},
  following : {type : [ObjectId], default : []},
  followers : {type : [ObjectId], default : []},
  description : {type : String , default : ""}
});


module.exports = mongoose.model('User',UserSchema) ;
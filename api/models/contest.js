const mongoose = require('mongoose')

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const contestSchema = new Schema({
  _id : ObjectId,
  createdAt : {type : Date , default: Date.now},
  
  posts: {type : [ObjectId], default: []},
  description : {type :String ,  default : ""},
  title : {type :String , required : true},
  domaines : {type :[String] , required : true,default:[]},
  creatorName : {type : String , required : true},
  creatorRef : {type : ObjectId , required : true},
  mediaUrl : {type : String }, 
  deadline : {type :Date , required : true}, 
  prize : {type : String , required : true }, 
  maximumCapcity : {type : Number , default : -1 }
});


module.exports = mongoose.model('Contest',contestSchema) ;
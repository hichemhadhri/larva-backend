const mongoose = require('mongoose')

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const postSchema = new Schema({
  _id : ObjectId,
  createdAt : {type : Date , default: Date.now},
  backgroundColor : {type : String , default : "000000"},
  comments : {type : [{
      author : {type :String , required : true},
      authorPdp : {type :String , required : true} , 
      createdAt : {type : Date , default : Date.now},
      content : {type :String , required : true}
  }], default : []},
  contests: {type : [ObjectId], default: []},
  description : {type :String , required : true},
  title : {type :String , required : true},
  domaine : {type :String , required : true},
  priority : {type : Number , default :100},
  rating : {type : Number , default :1},
  views : {type : Number , default :0},
  superlikes : {type : Number , default :0},
  type : {type : String },
  authorName : {type : String , required : true},
  authorPdp : {type : String },
  authorRef : {type : ObjectId , required : true},
  mediaUrl : {type : String , required: true}
});


module.exports = mongoose.model('Post',postSchema) ;
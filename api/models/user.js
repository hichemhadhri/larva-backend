const mongoose = require('mongoose')

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;
const Post = require("../models/post")
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require("../models/aws");


// const UserSchema = new Schema({
//   _id : ObjectId,
//   mail : {type : String, required : true , unique : true ,
// match : /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/},
//   name : {type : String, required : true} , 
//   surname : {type : String, required : true} , 
//   password : {type : String, required : true} , 
//   age : { type: Number, min: 18, max: 65 },
//   sexe  : {type : String, required : true} , 
//   createdAt : { type: Date, default: Date.now },
//   userPdp : {type : String ,default : ""} , 
//   pubs: {type : [ObjectId] ,  default : []},
//   favorites : {type : [ObjectId] , default : []},
//   following : {type : [ObjectId], default : []},
//   followers : {type : [ObjectId], default : []},
//   description : {type : String , default : ""}
// });



const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  surname: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String, // URL to user's profile picture
    default: ''
  },
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  joinedContests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest'
  }],
  ratings: [{
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    }
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  favoritePosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdContests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest'
  }]
}, { timestamps: true });



userSchema.pre('findOneAndDelete', async function (next) {
  try {
    const user = await this.model.findOne(this.getFilter());

    // Remove all posts by the user
    await Post.deleteMany({ author: user._id }).exec();

    // Remove this user from followers' following lists
    await this.model.updateMany(
      { following: user._id },
      { $pull: { following: user._id } }
    ).exec();

    // Remove this user from following users' followers lists
    await this.model.updateMany(
      { followers: user._id },
      { $pull: { followers: user._id } }
    ).exec();

    // Delete profile picture from S3
    if (user.profilePicture) {
      const profilePictureKey = user.profilePicture.split('/').pop();
      const deleteParams = {
        Bucket: process.env.S3_USERS_BUCKET,
        Key: `users/pdp/${profilePictureKey}`
      };

      const command = new DeleteObjectCommand(deleteParams);
      await s3Client.send(command);
    }

    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model('User', userSchema);






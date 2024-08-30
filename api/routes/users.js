const express = require("express");

const router = express.Router();
const mongoose = require('mongoose')
const User = require("../models/user")
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const checkAuth = require("../middlewares/check_auth");
const s3Client = require("../models/aws");
const multer = require('multer');
const fs = require("fs")
const Post = require("../models/post")

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');


const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');

const { Upload } = require('@aws-sdk/lib-storage');


const util = require('util')
const unlink = util.promisify(fs.unlink)

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,

});


require('dotenv').config();





//sign up route
router.post("/sign", async (req, res, next) => {
    try {
        const existingUsers = await User.find({ email: req.body.email }).exec();
        if (existingUsers.length >= 1) {
            const error = new Error("User with email already exists");
            error.status = 409;
            next(error);
        } else {
            console.log(req.body.email);
            const hashedPassword = await bcrypt.hash(req.body.password, 10);
            const newUser = new User({
                email: req.body.email,
                name: req.body.name,
                surname: req.body.surname,
                password: hashedPassword,
                profilePicture: '', // Default value
                points: 0, // Default value
                bio: '', // Default value
                following: [],
                followers: [],
                favoritePosts: []
            });
            const user = await newUser.save();
            const token = jwt.sign(
                { userId: user._id, email: user.email },
                process.env.JWT_KEY, {
                expiresIn: "1d"
            });
            return res.status(200).json({
                user: user,
                token: token
            });
        }
    } catch (err) {
        console.log(err);
        const error = new Error(err.message);
        error.status = 500;
        next(error);
    }
});

//login route
router.post("/login", async (req, res, next) => {
    try {
        const user = await User.find({ email: req.body.email }).exec();
        if (user.length === 0) {
            const error = new Error("User with email not found");
            error.status = 404;
            throw error;
        }

        const validatePassword = await bcrypt.compare(req.body.password, user[0].password);
        if (validatePassword) {
            const token = jwt.sign(
                { userId: user[0]._id, email: user[0].email },
                process.env.JWT_KEY, {
                expiresIn: "1d"
            }
            );
            res.status(200).json({
                user: user[0],
                token: token
            });
        } else {
            const error = new Error("Password is wrong");
            error.status = 401;
            throw error;
        }
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});

/**
 * return User with Id 'id'
 */
router.get("/:id", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).exec();
        res.status(200).json({
            user: user

        });
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});

/**
 * return User's posts with Id 'id'
 */
router.get("/:id/posts", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate({
            path: 'posts',
            model: 'Post',
            populate: {
                path: 'contests',
                model: 'Contest',
                select: 'name'
            }
        }).exec();

        if (!user) {
            const error = new Error("User not found");
            error.status = 404;
            throw error;
        }

        const posts = user.posts; // Directly access the populated posts

        res.status(200).json(posts);
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});



/**
 * Return user's favorite posts
 */
router.get("/:id/favorites", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate({
            path: 'favoritePosts.post',
            model: 'Post',
            populate: {
                path: 'contests',
                model: 'Contest',
                select: 'name'
            }
        }).exec();

        if (!user) {
            const error = new Error("User not found");
            error.status = 404;
            throw error;
        }

        const favoritePosts = user.favoritePosts.map(favorite => favorite.post);

        res.status(200).json(favoritePosts);
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});


/**
 * Change profile picture
 */
router.put("/:id/picture", checkAuth, upload.single("file"), async (req, res, next) => {
    try {
        if (req.userData.userId !== req.params.id) {
            const error = new Error("Unauthorized");
            error.status = 403;
            throw error;
        }

        const fileStream = fs.createReadStream(req.file.path);
        const uploadParams = {
            Bucket: process.env.S3_USERS_BUCKET,
            Key: `users/pdp/${req.file.filename}`,
            Body: fileStream
        };

        const upload = new Upload({
            client: s3Client,
            params: uploadParams
        });

        const upRes = await upload.done();
        await unlink(req.file.path);

        const newProfilePicture = {
            profilePicture: `users/pdp/${req.file.filename}` // Use the full URL of the uploaded file
        };

        // Retrieve user and change profile picture
        const user = await User.findByIdAndUpdate(req.params.id, newProfilePicture, { new: true }).exec();

        // Change profile picture for each post
        await Post.updateMany(
            { author: user._id },
            { "$set": { authorProfilePicture: `users/pdp/${req.file.filename}` } }
        ).exec();

        res.status(200).json({
            message: 'Update Successful',
            profilePicture: user.profilePicture
        });

    } catch (err) {
        const error = new Error(err.message);
        console.log(error.message);
        error.status = err.status || 500;
        next(error);
    }
});



/**
 * Return user profile picture from pic Id (no need for checkAuth)
 */
router.get("/pdp/:key", async (req, res, next) => {
    try {
        const downloadParams = {
            Bucket: process.env.S3_USERS_BUCKET,
            Key: `users/pdp/${req.params.key}`
        };

        const command = new GetObjectCommand(downloadParams);
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Error fetching stream: ${response.statusText}`);

        const bodyStream = Readable.from(response.body);

        bodyStream.on('error', (error) => {
            next(new Error(`Error reading stream: ${error.message}`));
        });

        bodyStream.pipe(res);
    } catch (err) {
        const error = new Error(err.message);
        error.status = 500;
        next(error);
    }
});


/**
 * Update user profile information
 */
router.put("/:id/profile", checkAuth, async (req, res, next) => {
    try {
        if (req.userData.userId !== req.params.id) {
            const error = new Error("Unauthorized");
            error.status = 403;
            throw error;
        }

        const updatedProfile = {
            name: req.body.name,
            surname: req.body.surname,
            bio: req.body.bio, // Add any other fields you want to allow updates for
        };

        const user = await User.findByIdAndUpdate(req.params.id, updatedProfile, { new: true }).exec();
        res.status(200).json(user);
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});


/**
 * Delete user account
 */
router.delete("/:id", checkAuth, async (req, res, next) => {
    try {
        if (req.userData.userId !== req.params.id) {
            const error = new Error("Unauthorized");
            error.status = 403;
            throw error;
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            const error = new Error("User not found");
            error.status = 404;
            throw error;
        }

        // This will trigger the pre-remove middleware
        await User.findByIdAndDelete(req.params.id).exec();

        res.status(200).json({ message: 'User account and associated data deleted successfully' });
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});
/**
 * Follow a user
 */
router.post("/:id/follow", checkAuth, async (req, res, next) => {
    try {
        const userId = req.userData.userId;
        const userToFollowId = req.params.id;

        console.log(userId, userToFollowId);

        if (userId === userToFollowId) {
            const error = new Error("You cannot follow yourself");
            error.status = 400;
            throw error;
        }

        const user = await User.findById(userId).exec();
        const userToFollow = await User.findById(userToFollowId).exec();

        if (!userToFollow) {
            const error = new Error("User not found");
            error.status = 404;
            throw error;
        }

        if (!user.following.includes(userToFollowId)) {
            user.following.push(userToFollowId);
            userToFollow.followers.push(userId);

            await user.save();
            await userToFollow.save();
        }

        res.status(200).json({ message: "User followed successfully" });
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});



/**
 * Unfollow a user
 */
router.post("/:id/unfollow", checkAuth, async (req, res, next) => {
    try {
        const userId = req.userData.userId;
        const userToUnfollowId = req.params.id;

        const user = await User.findById(userId).exec();
        const userToUnfollow = await User.findById(userToUnfollowId).exec();

        if (!userToUnfollow) {
            const error = new Error("User not found");
            error.status = 404;
            throw error;
        }

        if (user.following.includes(userToUnfollowId)) {
            user.following = user.following.filter(id => id.toString() !== userToUnfollowId);
            userToUnfollow.followers = userToUnfollow.followers.filter(id => id.toString() !== userId);

            await user.save();
            await userToUnfollow.save();
        }

        res.status(200).json({ message: "User unfollowed successfully" });
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});


/**
 * Get followers list
 */
router.get("/:id/followers", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('followers', 'name surname profilePicture').exec();
        res.status(200).json(user.followers);
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});


/**
 * Get following list
 */
router.get("/:id/following", async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('following', 'name surname profilePicture').exec();
        res.status(200).json(user.following);
    } catch (err) {
        const error = new Error(err.message);
        error.status = err.status || 500;
        next(error);
    }
});




module.exports = router; 
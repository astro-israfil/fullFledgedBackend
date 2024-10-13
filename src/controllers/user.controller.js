import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

export const registerUser = asyncHandler(async function (req, res) {
  // get user details from frontend
  // validate each field if it is not empty.
  // check user is already exist or not. ==> username, email
  // check images or check for avatar.
  // upload them to cloudinary.
  // create user object and save in db.
  // remove password and refresh token field from user object
  // check for user creation
  // res.

  const { fullName, username, email, password } = req.body;
  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with the email or username is already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files?.coverImage &&
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar image is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(500, "Internal cloudinary upload error");
  }

  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = user
    ? await User.findById(user._id).select("-password -refreshToken")
    : null;
  if (!createdUser) {
    throw new ApiError(500, "Internal database error");
  }
  return res.status(201).json(new ApiResponse(201, createdUser));
});

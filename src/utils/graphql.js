import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { makeExecutableSchema } from 'graphql-tools';

// TYPES

const typeDefs = `
  type UserType {
    _id: String!
    email: String!
    password: String!
    jwt: String
    firstName: String
    lastName: String
    userName: String
    dob: String
    height: Int
    trainingYears: Int
  }
  type SetType {
    reps: Int
    weight: Int
  }
  type ExerciseMuscleType {
    name: String
    equipment: String
  }
  type ExerciseSetType {
    muscleGroup: String
    recoveryTime: String
    exercise: ExerciseMuscleType
    sets: [SetType]
  }
  type ExercisesDayType {
    day: String
    isDayOff: Boolean
		isCollapsed: Boolean
    exercises: [ExerciseSetType]
  }
  type ProgramType {
    _id: String
    _userId: String
    name: String
    active: Boolean
    days: [ExercisesDayType]
  }

	input UserLoginType {
    email: String!
    password: String!
  }
  input UserSignUpType {
    email: String!
  	password: String!
  }
  input UserUpdateType {
    email: String
    firstName: String
    lastName: String
    userName: String
    dob: String
    height: Int
    trainingYears: Int
  }
  input SetCreateType {
    reps: Int!
    weight: Int!
  }
  input ExerciseMuscleCreateType {
    name: String!
    equipment: String!
  }
  input ExercisesSetCreateType {
    muscleGroup: String!
    recoveryTime: String!
    exercise: ExerciseMuscleCreateType!
    sets: [SetCreateType]!
  }
  input ExercisesDayCreateType {
    day: String!
    isDayOff: Boolean!
		isCollapsed: Boolean
    exercises: [ExercisesSetCreateType]!
  }
  input ProgramCreateType {
    name: String!
    active: Boolean!
    days: [ExercisesDayCreateType]!
  }

  type Query {
    currentUser: UserType
  }

  type Mutation {
    login (input: UserLoginType): UserType
		signup (input: UserSignUpType): UserType
		updateUser (input: UserUpdateType): UserType
		createProgram (input: ProgramCreateType): ProgramType
  }
`;

// RESOLVERS

const resolvers = {
    Query: {
        currentUser: (root, args, context) => context.user
    },
    Mutation: {
        login: async (root, { input }, { mongo }) => {
            const email = input.email;
            const password = input.password;
            const Users = mongo.collection('users');
            const user = await Users.findOne({ email });
            if (!user) {
                throw new Error('Email not found');
            }
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                throw new Error('Password is incorrect');
            }
            user.jwt = jwt.sign({ _id: user._id }, '3rEK7rDx9rMU!');
            return user;
        },
        signup: async (root, {input}, { mongo }) => {
            const email = input.email;
            const Users = mongo.collection('users');
            const existingUser = await Users.findOne({ email });
            if (existingUser) {
                throw new Error('Email already used');
            }
            const hash = await bcrypt.hash(input.password, 10);
            await Users.insert({
                email,
                password: hash,
            });
            const user = await Users.findOne({ email });
            user.jwt = jwt.sign({ _id: user._id }, '3rEK7rDx9rMU!');
            return user;
        },
        updateUser: async (root, {input}, context) => {
            console.log(context)
            const Users = context.mongo.collection('users');
            const user = context.user;
            if (!user) {
                throw new Error(`Couldn't find user`);
            }
            const newArgs = Object.keys(input).reduce((prevResult, current) => {
                if (input[current] == null) return prevResult;
                return Object.assign(prevResult, {[current]: input[current]})
            }, {})
            await Users.update({ _id: ObjectId(user._id) }, {$set: newArgs})
            const modifiedUser = await Users.findOne({ _id: ObjectId(user._id) });
            return modifiedUser;
        },
        createProgram: async (root, {input}, context) => {
            const program = input;
            const Programs = context.mongo.collection('programs');
            const currentUser = context.user;
            if (!currentUser) {
                throw new Error('No current user to assign the program');
            }
            program._userId = currentUser._id;
            const result = await Programs.insert(program);

            const programResult = await Programs.findOne(result.ops._id);
            return programResult
        }
    }
};

const getUser = async (authorization, mongo) => {
    const bearerLength = "Bearer ".length;
    if (authorization && authorization.length > bearerLength) {
        const token = authorization.slice(bearerLength);
        const { ok, result } = await new Promise(resolve =>
            jwt.verify(token, '3rEK7rDx9rMU!', (err, result) => {
                if (err) {
                    resolve({
                        ok: false,
                        result: err
                    });
                } else {
                    resolve({
                        ok: true,
                        result
                    });
                }
            })
        );
        if (ok) {
            const user = await mongo.collection('users').findOne({ _id: ObjectId(result._id) });
            return user;
        } else {
            console.error(result);
            return null;
        }
    }
    return null;
};

export const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

let mongo;
let client;
export async function context(headers, secrets) {
    if (!mongo) {
        client = await MongoClient.connect('mongodb://Haskkor:3rEN7rDm9rMB!@ds249398.mlab.com:49398/sport-log-db');
        mongo = client.db('sport-log-db');
    }
    const user = await getUser(headers['authorization'], mongo);
    return {
        headers,
        secrets,
        mongo,
        user
    };
};

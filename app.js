const express = require("express");
const app = express();

module.exports = app;

app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

let db;

// initialize database and server

const initDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server online");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initDbAndServer();

// authorize token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUser = `
  SELECT * FROM user WHERE username='${username}';`;

  const dbUser = await db.get(selectUser);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (isPasswordCorrect) {
      const jwtToken = jwt.sign(username, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//API 1
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesListQuery = `SELECT * FROM state;`;
  const result = await db.all(getAllStatesListQuery);

  const convertDbObjectToResponseObject = (object) => {
    return {
      stateId: object.state_id,
      stateName: object.state_name,
      population: object.population,
    };
  };

  const resultList = result.map((r) => convertDbObjectToResponseObject(r));
  response.send(resultList);
});

//API 2
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getSpecificState = `SELECT * FROM state WHERE state_id=${stateId};`;
  const result = await db.get(getSpecificState);

  const convertDbObjectToResponseObject = (object) => {
    return {
      stateId: object.state_id,
      stateName: object.state_name,
      population: object.population,
    };
  };

  const resultList = convertDbObjectToResponseObject(result);
  response.send(resultList);
});

//API 3
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addNewDistrictQuery = `INSERT INTO 
  district (district_name,state_id,cases,cured,active,deaths) 
  VALUES 
  ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  await db.run(addNewDistrictQuery);
  response.send("District Successfully Added");
});

//API 4
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getSpecificDistrict = `SELECT * FROM district WHERE district_id=${districtId};`;
    const result = await db.get(getSpecificDistrict);

    const convertDbObjectToResponseObject = (object) => {
      return {
        districtId: object.district_id,
        districtName: object.district_name,
        stateId: object.state_id,
        cases: object.cases,
        cured: object.cured,
        active: object.active,
        deaths: object.deaths,
      };
    };

    const resultList = convertDbObjectToResponseObject(result);
    response.send(resultList);
  }
);

// API 5
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `UPDATE
   district SET 
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths} 
  WHERE district_id=${districtId}`;

    const result = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `SELECT
  SUM(district.cases) AS cases,
  SUM(district.cured) AS cured,
  SUM(district.active) AS active,
  SUM(district.deaths) AS deaths
  FROM state
  LEFT JOIN district
  ON state.state_id = district.state_id
  WHERE state.state_id=${stateId};`;

    const result = await db.get(getStateStatsQuery);

    const convertDbObjectToResponseObject = (object) => {
      return {
        totalCases: object.cases,
        totalCured: object.cured,
        totalActive: object.active,
        totalDeaths: object.deaths,
      };
    };
    const responseObject = convertDbObjectToResponseObject(result);
    response.send(responseObject);
  }
);

// API 8
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `SELECT * 
    FROM state 
    LEFT JOIN district 
    ON state.state_id=district.state_id 
    WHERE district.district_id=${districtId};`;

    const result = await db.get(getDistrictDetailsQuery);
    const convertDbObjectToResponseObject = (object) => {
      return {
        stateName: object.state_name,
      };
    };
    const responseObject = convertDbObjectToResponseObject(result);
    response.send(responseObject);
  }
);

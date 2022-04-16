export const project = {
  Backend: [
    {
      title: "Restful API",
      pills: ["express.js", "typescript"],
      content: <div>
        <p>
          Sequelize as the ORM, Redis for hot data storage, CRUD api design, Joi for schema validation.
          Using intuitive versioning and route naming to ensure long term maintainability.
        </p>
        <p>
          Projects related to backend development:
          <ul>
            <li>User management module</li>
            <li>Microservices</li>
            <li>Worker applications</li>
          </ul>
        </p>
      </div>,
    },
    {
      title: "Chatbot",
      pills: ["typescript"],
      content: <div>
        <p>
          Using npm package <code>node-nlp</code> to perform keyword entity extraction and basic neural network to
          respond to user free text. Application design is perfect for frequently asked questions and business flows
          that is keyword-sensitive.
        </p>
        <p>
          Optimisations include:
          <ul>
            <li>
              text filtering with synonyms dictionaries
            </li>
            <li>
              action-object groupings
            </li>
          </ul>
        </p>
      </div>,
    },
    {
      title: "NodeBB Forums",
      pills: ["node.js"],
      content: <div>
        <p>
          Customising nodebb as a general purpose forum server, and developing plugins using Typescript 
          for highest type-safeness.
        </p>
        <p>
          Plugin includes:
          <ul>
            <li>Authentication integration with Auth0</li>
          </ul>
        </p>
      </div>,
    },
  ],
  Cloud: [
    {
      title: "AWS",
      pills: ["cloud computing"],
      content: <div>
        <p>
          Provisioning EC2 for VM instances. 
          Fargate for scalable service cluster. 
          S3 & Cloudfront & Route53 for static webpages hosting.
        </p>
      </div>,
    },
    {
      title: "OVH Cloud",
      pills: ["cloud computing"],
      content: <div>
        <p>
          Smaller cloud instances provider, perfect for small-scale business 
        </p>
      </div>,
    },
    {
      title: "Others",
      pills: ["DNS", "Nginx"],
      content: <div>
        <p>
          Configuring DNS for email forwarding and linking domain name with IP (using Dynadot and OVH Cloud technology).
        </p>
        <p>
          Web server configuration with Nginx: SSL configuration with the latest TLS1.2, rate limiting, load balancing, etc.
        </p>
      </div>,
    },
  ],
  Data: [
    {
      title: "Restful API",
      pills: ["express.js", "typescript"],
      content: <div>
        <p>
          Sequelize as the ORM, Redis for hot data storage, CRUD api design, Joi for schema validation.
          Using intuitive versioning and route naming to ensure long term maintainability.
        </p>
        <p>
          Projects related to backend development:
          <ul>
            <li>User management module</li>
            <li>Microservices</li>
            <li>Worker applications</li>
          </ul>
        </p>
      </div>,
    },
    {
      title: "Chatbot",
      pills: ["typescript"],
      content: <div>
        <p>
          Using npm package <code>node-nlp</code> to perform keyword entity extraction and basic neural network to
          respond to user free text. Application design is perfect for frequently asked questions and business flows
          that is keyword-sensitive.
        </p>
        <p>
          Optimisations include:
          <ul>
            <li>
              text filtering with synonyms dictionaries
            </li>
            <li>
              action-object groupings
            </li>
          </ul>
        </p>
      </div>,
    },
    {
      title: "NodeBB Forums",
      pills: ["node.js"],
      content: <div>
        <p>
          Customising nodebb as a general purpose forum server, and developing plugins using Typescript 
          for highest type-safeness.
        </p>
        <p>
          Plugin includes:
          <ul>
            <li>Authentication integration with Auth0</li>
          </ul>
        </p>
      </div>,
    },
  ],
}

using System;
using System.Collections.Generic;
using System.Text;

namespace ColocDuty
{
    class ColocPlayer
    {
        public readonly Guid Guid;
        public readonly string Username;

        public ColocPlayer(Guid guid, string username)
        {
            Guid = guid;
            Username = username;
        }
    }
}
